/**
 * 王铁 OS — OceanBase Oracle 模式单元测试。
 * 覆盖：连接参数、Oracle 数据字典映射、SQL 构造（绑定变量/日期转换/ROWID）、
 * 事务与并发校验、错误翻译、路由来源校验。全部使用假连接，不接触真实数据库。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtemp, rm } from 'node:fs/promises'
import { writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildDelete, buildInsert, buildRowQuery, buildUpdate, columnFrom, connectionFailure, connectionOptions, displayType,
  executeOceanBase, identifier, keyCondition, keySpecOf, orderClause, parseUser, perform, resolveProfile, schemasOf, serialRow,
  tenantOfUser, valueExpression, whereFilter, ROWID_FIELD, type Column,
} from '../src/oceanbase.ts'
import { describeFailure, mountOceanBase } from '../src/oceanbase-routes.ts'
import { handleProfileAction, listProfiles, removeProfile, saveProfile } from '../src/connections.ts'
import {
  compareSnapshots, environmentsForDisplay, loadEnvironments, readSnapshot, runComparison, testEnvironments, type SchemaSnapshot, type SnapshotObject,
} from '../src/ddl-compare.ts'

const column = (name: string, extra: Partial<Column> = {}): Column => ({
  name, type: 'VARCHAR2(50)', dataType: 'VARCHAR2', nullable: true, defaultValue: null,
  primary: false, identity: false, virtual: false, binary: false, lob: false, comment: '', ...extra,
})
const columns: Column[] = [
  column('ID', { type: 'NUMBER(19)', dataType: 'NUMBER', nullable: false, primary: true }),
  column('NAME', { nullable: false }),
  column('AMOUNT', { type: 'NUMBER(19,6)', dataType: 'NUMBER' }),
  column('CREATED_AT', { type: 'DATE', dataType: 'DATE' }),
  column('NOTE', { type: 'CLOB', dataType: 'CLOB', lob: true }),
]
const row = { ID: '9007199254740993', NAME: '原名', AMOUNT: '123456789.123456789', CREATED_AT: '2026-01-02 03:04:05', NOTE: null }
const key = { ID: row.ID }
const target = { schema: 'WT', table: 'CUSTOMERS' }

/* ------------------------------ 连接与标识符 ------------------------------ */

test('connection accepts the OceanBase client fields and builds a MySQL-protocol login', () => {
  // 与 OceanBase 客户端「新建数据源」一致的字段：主机 / 端口 / 集群名 / 租户名 / 用户名 / 密码
  const { driver, fields } = resolveProfile({
    mode: 'oracle', host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER', tenant: 'obtenant_sit',
    user: 'OB_USER', password: 'p', tls: false,
  })
  assert.equal(driver.host, '10.0.0.10')
  assert.equal(driver.port, 2883)
  assert.equal(driver.user, 'OB_USER@obtenant_sit#OB_CLUSTER', '账号必须是 user@租户#集群')
  assert.equal(driver.connectTimeout, 12_000, '连接阶段必须有自己的超时，避免挂死到前端 28 秒')
  assert.equal(driver.namedPlaceholders, true, 'Oracle 方言 SQL 用 :p1 命名绑定')
  assert.equal(driver.multipleStatements, false, '禁用多语句')
  assert.equal(driver.database, undefined, '默认不指定模式，查询里始终带模式限定')
  assert.deepEqual(fields, { host: '10.0.0.10', port: 2883, database: '', user: 'OB_USER@obtenant_sit#OB_CLUSTER', tenant: 'obtenant_sit', cluster: 'OB_CLUSTER', tls: false })

  // 默认模式（等价于 JDBC 连接串里 host:port/ 后面那段）可以显式指定
  assert.equal(connectionOptions({ mode: 'oracle', host: 'h', user: 'OB_USER', tenant: 'obtenant_sit', password: 'p', database: 'OB_USER' }).database, 'OB_USER')
  // 也接受直接把完整账号粘进来（会拆出租户与集群）
  const pasted = resolveProfile({ mode: 'oracle', host: 'h', user: 'OB_USER@obtenant_sit#OB_CLUSTER', password: 'p' })
  assert.equal(pasted.driver.user, 'OB_USER@obtenant_sit#OB_CLUSTER')
  assert.equal(pasted.fields.tenant, 'obtenant_sit')
  // 只有用户名没有 @ 时，必须显式给租户名
  assert.throws(() => resolveProfile({ mode: 'oracle', host: 'h', user: 'OB_USER', password: 'p' }), /租户名/)
  // 集群名可省略
  assert.equal(connectionOptions({ mode: 'oracle', host: 'h', user: 'a', tenant: 't', password: 'p' }).user, 'a@t')
  // 端口与 TLS
  assert.equal(connectionOptions({ mode: 'oracle', host: 'h', port: 2881, user: 'a', tenant: 't', password: 'p' }).port, 2881)
  assert.deepEqual(connectionOptions({ mode: 'oracle', host: 'h', user: 'a', tenant: 't', password: 'p', tls: true }).ssl, { rejectUnauthorized: false })
  assert.equal(connectionOptions({ mode: 'oracle', host: 'h', user: 'a', tenant: 't', password: 'p' }).ssl, undefined)
  // 明显的填错要拦下来，而不是带着错参数去连
  assert.throws(() => resolveProfile({ mode: 'oracle', host: 'h', user: 'a@t', tenant: 'other', password: 'p' }), /租户不一致/)
  assert.throws(() => resolveProfile({ mode: 'oracle', host: 'h', user: 'a@t#c1', cluster: 'c2', password: 'p' }), /集群不一致/)
  assert.throws(() => resolveProfile({ mode: 'oracle', host: 'h', user: 'a#b', tenant: 't', password: 'p' }), /用户名本身/)
  assert.throws(() => resolveProfile({ mode: 'oracle', host: 'h', user: 'a@t', password: 'p', database: 'a b' }), /默认模式/)
  assert.throws(() => resolveProfile({ mode: 'oracle', host: 'h', user: 'a@t', password: 'p', port: 65536 }), /端口/)
  assert.throws(() => resolveProfile({ mode: 'oracle', host: 'h', user: 'a@t', password: 'p', port: 0 }), /端口/)
  assert.throws(() => resolveProfile({ mode: 'oracle', host: 'h', user: 'a@t' }), /密码/)
  assert.throws(() => resolveProfile({ mode: 'oracle', host: '', user: 'a@t', password: 'p' }), /主机/)
  assert.throws(() => resolveProfile({ mode: 'mysql', host: 'h', user: 'a@t', password: 'p' }), /Oracle/)
})

test('identifiers use Oracle double quotes and escape embedded quotes', () => {
  assert.equal(identifier('CUSTOMERS'), '"CUSTOMERS"')
  assert.equal(identifier('we"ird'), '"we""ird"')
})

test('data dictionary rows map to display types and column flags', () => {
  assert.equal(displayType({ data_type: 'VARCHAR2', char_length: 50, char_used: 'C' }), 'VARCHAR2(50 CHAR)')
  assert.equal(displayType({ data_type: 'VARCHAR2', data_length: 100 }), 'VARCHAR2(100)')
  assert.equal(displayType({ data_type: 'NUMBER', data_precision: 19, data_scale: 6 }), 'NUMBER(19,6)')
  assert.equal(displayType({ data_type: 'NUMBER', data_precision: 19, data_scale: 0 }), 'NUMBER(19)')
  assert.equal(displayType({ data_type: 'NUMBER' }), 'NUMBER')
  assert.equal(displayType({ data_type: 'TIMESTAMP(6)' }), 'TIMESTAMP(6)')
  assert.equal(displayType({ data_type: 'RAW', data_length: 64 }), 'RAW(64)')
  const mapped = columnFrom({
    column_name: 'PAYLOAD', data_type: 'BLOB', nullable: 'N', data_default: ' ', identity_column: 'NO',
    virtual_column: 'NO', comments: '附件', is_pk: 'Y',
  })
  assert.equal(mapped.binary, true)
  assert.equal(mapped.nullable, false)
  assert.equal(mapped.defaultValue, null)
  assert.equal(mapped.primary, true)
  assert.equal(mapped.comment, '附件')
  assert.equal(columnFrom({ column_name: 'ID', data_type: 'NUMBER', identity_column: 'YES' }).identity, true)
  assert.equal(columnFrom({ column_name: 'C', data_type: 'NUMBER', virtual_column: 'YES' }).virtual, true)
  assert.equal(columnFrom({ column_name: 'N', data_type: 'CLOB' }).lob, true)
})

/* --------------------------------- SQL 构造 -------------------------------- */

test('date and timestamp columns are converted explicitly instead of relying on NLS', () => {
  assert.match(valueExpression(column('D', { dataType: 'DATE' }), ':p1'), /^TO_DATE\(:p1, CASE WHEN INSTR\(:p1, ':'\) > 0/)
  assert.match(valueExpression(column('T', { dataType: 'TIMESTAMP(6)' }), ':p1'), /^TO_TIMESTAMP\(:p1, CASE WHEN INSTR\(:p1, '\.'\)/)
  assert.equal(valueExpression(column('N'), ':p1'), ':p1')
})

test('filters bind values, use INSTR for substring and TO_DATE for date columns', () => {
  assert.deepEqual(whereFilter(columns, { column: 'NAME', op: 'contains', value: "%' OR 1=1" }),
    { sql: ' WHERE INSTR(TO_CHAR("NAME"), :p1) > 0', binds: { p1: "%' OR 1=1" } })
  assert.deepEqual(whereFilter(columns, { column: 'NOTE', op: 'null' }), { sql: ' WHERE "NOTE" IS NULL', binds: {} })
  assert.deepEqual(whereFilter(columns, { column: 'NOTE', op: 'notnull' }), { sql: ' WHERE "NOTE" IS NOT NULL', binds: {} })
  const dated = whereFilter(columns, { column: 'CREATED_AT', op: 'gte', value: '2026-01-01' })
  assert.match(dated.sql, /"CREATED_AT" >= TO_DATE\(:p1, CASE WHEN/)
  assert.deepEqual(dated.binds, { p1: '2026-01-01' })
  assert.throws(() => whereFilter(columns, { column: 'NAME', op: 'custom sql' }), /不支持/)
  assert.throws(() => whereFilter(columns, { column: 'MISSING', op: 'eq', value: 'x' }), /字段不存在/)
  assert.throws(() => whereFilter([column('B', { binary: true, dataType: 'BLOB' })], { column: 'B', op: 'eq', value: 'x' }), /二进制/)
  assert.throws(() => whereFilter(columns, { column: 'CREATED_AT', op: 'eq', value: 'not-a-date' }), /日期/)
})

test('ordering is deterministic: explicit NULLS placement plus primary key tie-break', () => {
  assert.equal(orderClause(columns, 'AMOUNT', 'desc', ['ID']), ' ORDER BY "AMOUNT" DESC NULLS FIRST, "ID" ASC')
  assert.equal(orderClause(columns, 'AMOUNT', 'asc', ['ID']), ' ORDER BY "AMOUNT" ASC NULLS LAST, "ID" ASC')
  assert.equal(orderClause(columns, 'ID', 'asc', ['ID']), ' ORDER BY "ID" ASC NULLS LAST')
  assert.equal(orderClause(columns, '', 'asc', []), '')
})

test('pagination wraps ROWNUM and appends ROWID only when the key is ROWID', () => {
  const primary = buildRowQuery(target, columns, { limit: 50, offset: 10, key: { mode: 'primary', columns: ['ID'] } })
  assert.match(primary.sql, /^SELECT \* FROM \(SELECT wt_inner\.\*, ROWNUM AS "wt_rn" FROM \(SELECT t\.\* FROM "WT"\."CUSTOMERS"/)
  assert.match(primary.sql, /WHERE ROWNUM <= :p_max\) WHERE "wt_rn" > :p_off$/)
  assert.deepEqual(primary.binds, { p_max: 61, p_off: 10 })
  const byRowid = buildRowQuery(target, columns, { limit: 1, offset: 0, key: { mode: 'rowid', columns: [ROWID_FIELD] } })
  assert.match(byRowid.sql, /SELECT t\.\*, t\.ROWID AS "wt_rowid" FROM/)
  assert.deepEqual(byRowid.binds, { p_max: 2, p_off: 0 })
})

test('insert binds every value and rejects columns Oracle will not accept', () => {
  const statement = buildInsert(target, columns, { NAME: '客户', CREATED_AT: '2026-01-02 03:04:05', AMOUNT: '1.5' })
  assert.match(statement.sql, /^INSERT INTO "WT"\."CUSTOMERS" \("NAME", "CREATED_AT", "AMOUNT"\) VALUES \(:p1, TO_DATE\(:p2,/)
  assert.deepEqual(statement.binds, { p1: '客户', p2: '2026-01-02 03:04:05', p3: '1.5' })
  const allDefault = buildInsert(target, columns, {})
  assert.equal(allDefault.sql, 'INSERT INTO "WT"."CUSTOMERS" ("ID", "NAME", "AMOUNT", "CREATED_AT", "NOTE") VALUES (DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT)')
  assert.deepEqual(allDefault.binds, {})
  const withVirtual = buildInsert(target, [column('A'), column('V', { virtual: true, dataType: 'NUMBER' })], {})
  assert.equal(withVirtual.sql, 'INSERT INTO "WT"."CUSTOMERS" ("A") VALUES (DEFAULT)')
  assert.throws(() => buildInsert(target, columns, { MISSING: 'x' }), /字段不存在/)
  assert.throws(() => buildInsert(target, columns, { NAME: 'x', BLOBCOL: 'y' }), /字段不存在/)
})

test('Oracle treats the empty string as NULL, and pre-validates numbers and dates', () => {
  assert.deepEqual(buildInsert(target, columns, { NAME: 'x', NOTE: '' }).binds, { p1: 'x', p2: null })
  assert.throws(() => buildInsert(target, columns, { NAME: '' }), /不能为 NULL/)
  assert.throws(() => buildInsert(target, columns, { NAME: 'x', AMOUNT: '12a' }), /需要数字/)
  assert.throws(() => buildInsert(target, columns, { NAME: 'x', CREATED_AT: '2026/01/02' }), /日期/)
  assert.throws(() => buildInsert(target, columns, { NAME: 'x'.repeat(4001) }), /4000/)
  const identity = column('SEQ', { identity: true, dataType: 'NUMBER' })
  assert.throws(() => buildInsert(target, [identity], { SEQ: '7' }), /标识列/)
  const binary = column('PAYLOAD', { binary: true, dataType: 'BLOB' })
  assert.throws(() => buildInsert(target, [binary], { PAYLOAD: 'FF' }), /二进制/)
})

test('update and delete require a complete key and never touch the primary key', () => {
  const statement = buildUpdate(target, columns, { mode: 'primary', columns: ['ID'] }, { key, original: row, values: { NAME: '新名', CREATED_AT: '2026-02-03' } })
  assert.match(statement.sql, /^UPDATE "WT"\."CUSTOMERS" SET "NAME" = :p1, "CREATED_AT" = TO_DATE\(:p2,/)
  assert.match(statement.sql, /WHERE "ID" = :k1$/)
  assert.deepEqual(statement.binds, { p1: '新名', p2: '2026-02-03', k1: row.ID })
  assert.throws(() => buildUpdate(target, columns, { mode: 'primary', columns: ['ID'] }, { key, original: row, values: {} }), /没有需要修改的字段/)
  assert.throws(() => buildUpdate(target, columns, { mode: 'primary', columns: ['ID'] }, { key, original: row, values: { ID: '2' } }), /主键/)
  assert.throws(() => buildUpdate(target, columns, { mode: 'primary', columns: ['ID'] }, { key, original: {}, values: { NAME: 'x' } }), /原值/)
  assert.throws(() => buildUpdate(target, columns, { mode: 'primary', columns: ['ID'] }, { key: {}, original: row, values: { NAME: 'x' } }), /完整主键/)
  const byRowid = buildUpdate(target, columns, { mode: 'rowid', columns: [ROWID_FIELD] }, { key: { [ROWID_FIELD]: 'AAA' }, original: row, values: { NAME: 'x' } })
  assert.match(byRowid.sql, /WHERE ROWID = :k1$/)
  assert.deepEqual(byRowid.binds, { p1: 'x', k1: 'AAA' })
  assert.throws(() => buildDelete(target, { mode: 'primary', columns: ['ID'] }, { key, original: row }), /确认删除/)
  assert.equal(buildDelete(target, { mode: 'primary', columns: ['ID'] }, { key, original: row, confirm: true }).sql, 'DELETE FROM "WT"."CUSTOMERS" WHERE "ID" = :k1')
  assert.throws(() => keyCondition({ mode: 'none', columns: [] }, {}), /只能查询/)
  assert.throws(() => keyCondition({ mode: 'rowid', columns: [ROWID_FIELD] }, {}), /ROWID/)
})

test('key strategy prefers the primary key, falls back to ROWID for heap tables only', () => {
  assert.deepEqual(keySpecOf(columns, 'TABLE'), { mode: 'primary', columns: ['ID'] })
  assert.deepEqual(keySpecOf([column('NAME')], 'TABLE'), { mode: 'rowid', columns: [ROWID_FIELD] })
  assert.deepEqual(keySpecOf([column('NAME')], 'VIEW'), { mode: 'none', columns: [] })
  assert.deepEqual(keySpecOf([column('ID', { primary: true, binary: true, dataType: 'RAW' })], 'TABLE'), { mode: 'rowid', columns: [ROWID_FIELD] })
})

/* ------------------------------- 行结果序列化 ------------------------------ */

test('binary and Lob values are serialised as hex with a size cap', async () => {
  assert.deepEqual(await serialRow({ RAW: Buffer.from([0, 255, 39]) }), { RAW: { binaryHex: '00ff27' } })
  const big = await serialRow({ B: Buffer.alloc(5000, 1) }) as any
  assert.equal(big.B.truncated, true)
  assert.equal(big.B.length, 5000)
  assert.equal(big.B.binaryHex.length, 4096 * 2)
  let closed = false
  const lob = { length: 2, getData: async () => Buffer.from('hi'), close: async () => { closed = true } }
  assert.deepEqual(await serialRow({ BLOBCOL: lob }), { BLOBCOL: { binaryHex: '6869' } })
  assert.equal(closed, true, 'Lob must be closed to release the cursor')
  const failed = { length: 9, getData: async () => { throw new Error('lob gone') }, close: async () => {} }
  assert.deepEqual(await serialRow({ BLOBCOL: failed }), { BLOBCOL: { binaryHex: '', truncated: true, length: 9 } })
  assert.deepEqual(await serialRow({ D: new Date('2026-01-02T03:04:05Z') }), { D: '2026-01-02 03:04:05' })
})

/* ----------------------------- 事务与并发写入 ----------------------------- */

function fakeConnection(affectedRows = 1, lockedRow: Record<string, unknown> = row) {
  const calls: { sql: string; binds?: unknown }[] = []
  const dictionary = columns.map(item => ({
    COLUMN_NAME: item.name, DATA_TYPE: item.dataType, DATA_LENGTH: 50, CHAR_LENGTH: 50, CHAR_USED: 'C',
    DATA_PRECISION: null, DATA_SCALE: null, NULLABLE: item.nullable ? 'Y' : 'N', DATA_DEFAULT: item.defaultValue,
    IDENTITY_COLUMN: item.identity ? 'YES' : 'NO', VIRTUAL_COLUMN: item.virtual ? 'YES' : 'NO',
    COMMENTS: item.comment, IS_PK: item.primary ? 'Y' : 'N',
  }))
  const rowWithRownum = { ...row, wt_rn: 11 }
  // 仿真 mysql2：query(sql, binds) 返回 [rows|resultSetHeader, fields]
  const connection = {
    query: async (sql: string, binds?: unknown) => {
      calls.push({ sql, binds })
      if (/FROM all_tab_columns/i.test(sql)) return [dictionary, []]
      if (/FROM all_tables t/i.test(sql)) return [[{ NAME: 'CUSTOMERS', KIND: 'TABLE', COMMENTS: '' }], []]
      if (/FROM DUAL/i.test(sql)) return [[{ CURRENT_USER: 'OB_USER', DB_NAME: 'OBTEST' }], []]
      if (/v\$version/i.test(sql)) return [[{ BANNER: 'OceanBase_CE 4.3.0.0 (Oracle)' }], []]
      if (/FOR UPDATE/i.test(sql)) return [[lockedRow], []]
      if (/^SELECT \* FROM \(SELECT wt_inner/i.test(sql)) return [[rowWithRownum, { ...rowWithRownum, ID: '9007199254740994', wt_rn: 12 }], []]
      return [{ affectedRows }, []]
    },
    rollback: async () => { calls.push({ sql: 'ROLLBACK' }) },
    commit: async () => { calls.push({ sql: 'COMMIT' }) },
    end: async () => { calls.push({ sql: 'END' }) },
    destroy: () => { /* noop */ },
  }
  return { connection, calls }
}

test('row queries page with one extra row, strip the ROWNUM column and report the key strategy', async () => {
  const { connection, calls } = fakeConnection()
  const result = await perform(connection as never, 'rows', { schema: 'WT', table: 'CUSTOMERS', limit: 1, offset: 0 }) as any
  assert.equal(result.hasMore, true)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].ID, '9007199254740993')
  assert.equal('wt_rn' in result.rows[0], false, 'paging helper column must not leak to the client')
  assert.deepEqual(result.key, { mode: 'primary', columns: ['ID'], label: '主键' })
  assert.deepEqual(result.permissions, { insert: true, edit: true })
  assert.equal(result.tableType, 'TABLE')
  const sql = calls.find(call => call.sql.includes('wt_inner'))!.sql
  assert.match(sql, /ORDER BY "ID" ASC/)
  assert.deepEqual(calls.find(call => call.sql.includes('wt_inner'))!.binds, { p_max: 2, p_off: 0 })
  await assert.rejects(perform(connection as never, 'rows', { schema: 'WT', table: 'CUSTOMERS', limit: 99999 }), /分页/)
  await assert.rejects(perform(connection as never, 'rows', { schema: 'WT', table: 'CUSTOMERS', limit: 0 }), /每页行数/)
})

test('writes lock the row, compare the original snapshot and commit exactly once', async () => {
  const { connection, calls } = fakeConnection()
  await perform(connection as never, 'delete', { schema: 'WT', table: 'CUSTOMERS', key, original: row, confirm: true })
  const step = (sql: string): string => sql === 'ROLLBACK' || sql === 'COMMIT' ? sql
    : sql.startsWith('DELETE') ? 'DELETE'
      : /FOR UPDATE/.test(sql) ? 'LOCK'
        : ''
  assert.deepEqual(calls.map(call => step(call.sql)).filter(Boolean), ['ROLLBACK', 'LOCK', 'DELETE', 'COMMIT'])
  const lock = calls.find(call => /FOR UPDATE/.test(call.sql))!
  assert.match(lock.sql, /SELECT \* FROM "WT"\."CUSTOMERS" WHERE "ID" = :k1 FOR UPDATE$/)
  assert.deepEqual(lock.binds, { k1: row.ID })
})

test('a stale or unexpectedly broad write rolls back without committing', async () => {
  for (const affected of [0, 2]) {
    const { connection, calls } = fakeConnection(affected)
    await assert.rejects(perform(connection as never, 'update', { schema: 'WT', table: 'CUSTOMERS', key, original: row, values: { NAME: '新名' } }), /记录已被修改/)
    assert.equal(calls.at(-1)?.sql, 'ROLLBACK')
    assert.equal(calls.some(call => call.sql === 'COMMIT'), false)
  }
})

test('a changed row between read and write is reported as a conflict', async () => {
  const { connection } = fakeConnection(1, { ...row, NAME: '别人改过' })
  await assert.rejects(perform(connection as never, 'update', { schema: 'WT', table: 'CUSTOMERS', key, original: row, values: { NAME: 'x' } }), /记录已被修改/)
})

test('views and unknown schema objects stay read-only', async () => {
  const { connection } = fakeConnection()
  ;(connection as any).query = async (sql: string) => {
    if (/FROM all_tab_columns/i.test(sql)) return [[{ COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER', NULLABLE: 'Y', IS_PK: 'N', DATA_PRECISION: 10, DATA_SCALE: 0 }], []]
    if (/FROM all_tables t/i.test(sql)) return [[{ NAME: 'CUSTOMERS', KIND: 'VIEW', COMMENTS: '' }], []]
    if (/FROM DUAL/i.test(sql)) return [[{ CURRENT_USER: 'OB_USER', DB_NAME: 'OBTEST' }], []]
    if (/v\$version/i.test(sql)) return [[{ BANNER: 'OceanBase_CE 4.3.0.0 (Oracle)' }], []]
    if (/^SELECT \* FROM \(/i.test(sql)) return [[], []]
    return [{ affectedRows: 1 }, []]
  }
  const result = await perform(connection as never, 'rows', { schema: 'WT', table: 'CUSTOMERS' }) as any
  assert.equal(result.tableType, 'VIEW')
  assert.deepEqual(result.permissions, { insert: false, edit: false })
  await assert.rejects(perform(connection as never, 'insert', { schema: 'WT', table: 'CUSTOMERS', values: { ID: '1' } }), /只读/)
})

/* -------------------------------- 错误翻译 -------------------------------- */

test('Oracle and driver errors are translated without echoing credentials or SQL', () => {
  const missing = describeFailure(Object.assign(new Error('ORA-01400: cannot insert NULL into ("WT"."T"."NAME")'), { errorNum: 1400 }), 'insert')
  assert.equal(missing.status, 400)
  assert.equal(missing.body.error, '必填字段不能为 NULL')
  assert.equal(missing.body.code, 'ORA-01400')
  assert.doesNotMatch(JSON.stringify(missing.body), /WT.*T.*NAME/)

  assert.equal(describeFailure(Object.assign(new Error('ORA-00001: unique constraint'), { errorNum: 1 }), 'insert').body.error, '主键或唯一约束冲突：该值已存在')
  assert.equal(describeFailure(Object.assign(new Error('ORA-00942: table or view does not exist'), {}), 'rows').body.error, '表或视图不存在，或当前账号没有访问权限')
  assert.equal(describeFailure(Object.assign({ code: 'ER_UNKNOWN_ERROR', sqlMessage: 'ORA-00942: table or view does not exist' }), 'rows').body.error, '表或视图不存在，或当前账号没有访问权限')
  assert.equal(describeFailure(Object.assign({ code: 'ER_ACCESS_DENIED_ERROR', sqlMessage: 'Access denied' }), 'connect').body.error, '认证失败：账号、租户或密码不正确（账号需写成 用户名@租户名#集群名）')

  const lost = describeFailure(Object.assign(new Error('Connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' }), 'insert')
  assert.equal(lost.status, 503)
  assert.equal(lost.body.uncertain, true, 'a lost connection during a write has an unknown outcome')
  assert.match(lost.body.error, /写入结果尚未确认/)
  // 只读动作遇到同样的断连就是普通失败，不标「结果未知」。
  assert.equal(describeFailure(Object.assign(new Error('Connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' }), 'rows').status, 400)

  // 连接阶段就失败：什么都没写，必须是「确定失败」，否则会误导用户重复提交。
  const refused = describeFailure(connectionFailure(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })), 'insert')
  assert.equal(refused.status, 400)
  assert.equal(refused.body.uncertain, false)
  assert.equal(refused.body.code, 'ECONNREFUSED')
  assert.match(refused.body.error, /拒绝连接/)
  assert.equal(connectionFailure(Object.assign(new Error('getaddrinfo ENOTFOUND h'), { code: 'ENOTFOUND' })).message, '无法解析数据库主机名，请检查连接地址')
  assert.match(connectionFailure(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' })).message, /连接数据库超时/)
  assert.match(connectionFailure(Object.assign({ code: 'ER_ACCESS_DENIED_ERROR', message: 'Access denied', sqlMessage: 'Access denied for user' }), 'insert').message, /认证失败/)
  assert.equal(describeFailure(Object.assign(new Error('Lock wait timeout exceeded'), { code: 'ER_LOCK_WAIT_TIMEOUT' }), 'update').body.error, '记录正被其他会话锁定，请稍后重试')
  assert.equal(describeFailure(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }), 'insert').body.error, '主键或唯一约束冲突：该值已存在')
  // 勾了 TLS 连明文端口是最常见的误操作，错误信息要直接点出来
  assert.match(connectionFailure(Object.assign(new Error('SSL handshake failed'), { code: 'HANDSHAKE_SSL_ERROR' }), true).message, /取消勾选「使用 TLS」/)
  assert.doesNotMatch(connectionFailure(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }), true).message, /TLS/)
  assert.match(connectionFailure(new Error('something odd')).message, /无法连接数据库/)
  // 语句发出之后的连接中断仍然是「结果未知」。
  const midFlight = describeFailure(Object.assign(new Error('ORA-03113: end-of-file on communication channel'), { errorNum: 3113 }), 'update')
  assert.equal(midFlight.status, 503)
  assert.equal(midFlight.body.uncertain, true)

  assert.equal(describeFailure(new Error('request body too large'), 'connect').status, 413)
  assert.equal(describeFailure(new SyntaxError('Unexpected token'), 'connect').body.error, '请求 JSON 格式不正确')
  const generic = describeFailure(new Error('some driver noise with SQL SELECT * FROM secret'), 'rows')
  assert.equal(generic.body.error, '数据库操作失败，请检查字段类型、连接配置和账号权限')
  assert.doesNotMatch(JSON.stringify(generic.body), /secret/)
})

/* --------------------------------- 路由守门 -------------------------------- */

test('connect separates "network unreachable" from "protocol handshake failed"', async () => {
  const attempts: { host: string; port: number; timeoutMs?: number }[] = []
  const blocked = async (host: string, port: number, timeoutMs?: number) => {
    attempts.push({ host, port, timeoutMs })
    return { ok: false, code: 'ETIMEDOUT', detail: '连接超时（5000ms），目标主机无响应或防火墙拦截', ms: 5000 }
  }
  const body = {
    connection: { mode: 'oracle', host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER', tenant: 'obtenant_sit', user: 'OB_USER', password: 'SECRET-MARKER' },
  }
  // 网络层不通：必须说清是「跑服务的机器」连不上，而不是让用户去查参数
  await assert.rejects(executeOceanBase('connect', body, blocked), (error: Error) => {
    assert.match(error.message, /网络层不通/)
    assert.match(error.message, /10\.0\.0\.10:2883/)
    assert.match(error.message, /运行本服务的那台机器/)
    assert.doesNotMatch(error.message, /SECRET-MARKER/)
    return true
  })
  assert.deepEqual(attempts, [{ host: '10.0.0.10', port: 2883, timeoutMs: 5000 }], 'TCP 预检要带 5 秒上限')
})

test('routes reject wrong method, cross-origin, missing Origin and non-JSON before connecting', async () => {
  const routes: any[] = []
  mountOceanBase({ webServer: { register: route => { routes.push(route); return () => {} } } }, '/wangtie-os')
  assert.equal(routes.length, 11, 'connect / verify / profiles / ddl-environments / ddl-test / ddl-compare / tables / rows / insert / update / delete')
  assert.deepEqual(routes.map(route => route.path), ['connect', 'verify', 'profiles', 'ddl-environments', 'ddl-test', 'ddl-compare', 'tables', 'rows', 'insert', 'update', 'delete'].map(action => `/wangtie-os/api/oceanbase/${action}`))
  for (const [method, origin, contentType, expected] of [
    ['GET', 'http://localhost', 'application/json', 405],
    ['POST', 'http://evil.test', 'application/json', 403],
    ['POST', '', 'application/json', 403],
    ['POST', 'http://localhost', 'text/plain', 403],
  ]) {
    let status = 0
    await routes[0].handler({ method, headers: { host: 'localhost', origin, 'content-type': contentType } }, { writeHead: (s: number) => { status = s }, end: () => {} })
    assert.equal(status, expected)
  }
})

test('route rejects the MySQL mode hint without echoing supplied credentials', async () => {
  const routes: any[] = []
  mountOceanBase({ webServer: { register: route => { routes.push(route); return () => {} } } }, '/wangtie-os')
  const req = Object.assign(Readable.from([JSON.stringify({ connection: { mode: 'mysql', password: 'SECRET-MARKER' } })]), { method: 'POST', headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json' } })
  let status = 0, body = ''
  await routes[0].handler(req, { writeHead: (s: number) => { status = s }, end: (value: string) => { body = value } })
  assert.equal(status, 400)
  assert.match(body, /Oracle/)
  assert.doesNotMatch(body, /SECRET-MARKER/)
})


test('a 12c-less Oracle dictionary (no IDENTITY_COLUMN) degrades instead of breaking row queries', async () => {
  const calls: string[] = []
  const dictionaryRow = {
    COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER', DATA_LENGTH: 22, DATA_PRECISION: 19, DATA_SCALE: 0,
    NULLABLE: 'N', DATA_DEFAULT: null, COMMENTS: '主键', IS_PK: 'Y',
  }
  // 仿真 OceanBase 3.2：档 1 用到的 identity_column / virtual_column 不存在 → ORA-00904
  const connection = {
    query: async (sql: string, binds?: unknown) => {
      calls.push(sql)
      if (/identity_column|virtual_column/i.test(sql)) {
        throw Object.assign(new Error('ORA-00904: invalid identifier'), { code: 'ER_UNKNOWN_ERROR', sqlMessage: 'ORA-00904: invalid identifier' })
      }
      if (/FROM all_tab_columns/i.test(sql)) return [[dictionaryRow], []]
      if (/FOR UPDATE/i.test(sql)) return [[{ ID: '1' }], []]
      if (/FROM all_tables t/i.test(sql)) return [[{ NAME: 'CUSTOMERS', KIND: 'TABLE', COMMENTS: '' }], []]
      if (/FROM DUAL/i.test(sql)) return [[{ CURRENT_USER: 'OB_USER', DB_NAME: 'OBTEST' }], []]
      if (/v\$version/i.test(sql)) return [[{ BANNER: 'OceanBase_3.2.3.3' }], []]
      if (/^SELECT \* FROM \(SELECT wt_inner/i.test(sql)) return [[{ ID: '1', wt_rn: 1 }], []]
      return [{ affectedRows: 1 }, []]
    },
    rollback: async () => {}, commit: async () => {}, end: async () => {}, destroy: () => {},
  }
  const result = await perform(connection as never, 'rows', { schema: 'OB_USER', table: 'CUSTOMERS', limit: 10 }) as any
  assert.equal(result.rows.length, 1, '降级后行查询必须能跑通')
  assert.equal(result.columns[0].name, 'ID')
  assert.equal(result.columns[0].primary, true)
  assert.equal(result.columns[0].identity, false, '字典没有标识列信息时按 false 处理')
  assert.ok(calls.some(sql => /identity_column/i.test(sql)), '先试完整档')
  assert.ok(calls.some(sql => /FROM all_tab_columns/i.test(sql) && !/identity_column/i.test(sql)), '再降级重试')

  // 降级成功后会记住档位：下一个表的第一次查询就直接用降级档
  const before = calls.length
  await perform(connection as never, 'rows', { schema: 'OB_USER', table: 'CUSTOMERS', limit: 10 })
  assert.equal(calls.slice(before).some(sql => /identity_column/i.test(sql)), false, '档位被缓存，不再重复失败')
})

test('schemas fall back to visible owners and finally to the current account', async () => {
  const emptyUsers = {
    query: async (sql: string) => {
      if (/FROM all_users/i.test(sql)) return [[], []]
      if (/DISTINCT owner/i.test(sql)) return [[{ NAME: 'OB_USER' }, { NAME: 'SYS' }], []]
      throw new Error(`unexpected: ${sql}`)
    },
  }
  assert.deepEqual(await schemasOf(emptyUsers as never), ['OB_USER', 'SYS'])

  const nothingElse = {
    query: async (sql: string) => {
      if (/FROM all_users/i.test(sql)) throw Object.assign(new Error('ORA-00942: table or view does not exist'), { sqlMessage: 'ORA-00942' })
      if (/DISTINCT owner/i.test(sql)) return [[], []]
      if (/FROM DUAL/i.test(sql)) return [[{ NAME: 'OB_USER' }], []]
      throw new Error(`unexpected: ${sql}`)
    },
  }
  assert.deepEqual(await schemasOf(nothingElse as never), ['OB_USER'], '最后兜底用当前账号，保证下拉框不为空')
})


test('connection profiles: saved with alias and environment, never with a password', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wt-ob-'))
  process.env.DSH_HOME = dir
  try {
    const saved = saveProfile({
      name: '票据库 · 测试', env: '测试', host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER',
      tenant: 'obtenant_sit', user: 'OB_USER', password: 'must-not-be-stored',
    })
    assert.equal(saved.name, '票据库 · 测试')
    assert.equal(saved.env, '测试')
    assert.equal(saved.user, 'OB_USER')
    assert.equal(saved.tenant, 'obtenant_sit')
    assert.equal(saved.id, '10.0.0.10:2883/ob_user@obtenant_sit#ob_cluster', 'id 里的用户名不能重复拼接')

    const onDisk = readFileSync(join(dir, 'wangtie-os', 'connections.json'), 'utf8')
    assert.doesNotMatch(onDisk, /must-not-be-stored/, '密码绝不能落盘')

    // 再存一套生产库；列表里两套都在，且同一个地址+账号视为同一条（覆盖更新）
    saveProfile({ name: '票据库 · 生产', env: '生产', host: '10.9.9.9', user: 'OB_USER', tenant: 'bps_prod', cluster: 'OB_CLUSTER', password: '' })
    assert.equal(listProfiles().length, 2)
    saveProfile({ name: '票据库 · 测试（改）', env: '准生产', host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER', tenant: 'obtenant_sit', user: 'OB_USER', password: '' })
    const profiles = listProfiles()
    assert.equal(profiles.length, 2, '同一连接重复保存应覆盖而不是新增')
    assert.equal(profiles.find(item => item.host === '10.0.0.10')?.env, '准生产')

    // 动作分发与删除
    assert.equal((handleProfileAction({ op: 'save', profile: { name: 'x', env: '', host: 'h', user: 'u', tenant: 't', password: '' } }) as any).profile.tenant, 't')
    assert.equal((handleProfileAction({ op: 'list' }) as any).profiles.length, 3)
    const removed = removeProfile({ id: profiles[0]!.id }) as { removed: boolean }
    assert.equal(removed.removed, true)
    assert.equal(listProfiles().length, 2)

    // 校验：缺租户、坏端口等直接拒绝
    assert.throws(() => saveProfile({ host: 'h', user: 'u', password: '' }), /租户名/)
    assert.throws(() => saveProfile({ host: 'h', user: 'u', tenant: 't', port: 70000, password: '' }), /端口/)
    assert.throws(() => handleProfileAction({ op: 'drop' }), /list \/ save \/ remove/)
  } finally {
    delete process.env.DSH_HOME
    await rm(dir, { recursive: true, force: true })
  }
})

/* ------------------------------ DDL 比较（SIT↔UAT） ------------------------------ */

const snapshotObject = (name: string, columns: SnapshotObject['columns'], extra: Partial<SnapshotObject> = {}): SnapshotObject => ({
  name, type: 'TABLE', comment: '', columns, primaryKey: [], indexes: [], viewText: '', ...extra,
})
const snapshot = (environment: string, objects: SnapshotObject[]): SchemaSnapshot => ({ environment, schema: 'OB_USER', objects, warnings: [] })

test('DDL comparison reports added/removed objects, column, key and index differences', () => {
  const sit = snapshot('SIT', [
    snapshotObject('BILL_MAIN', [
      { name: 'ID', type: 'NUMBER(19)', nullable: false, defaultValue: null, comment: '主键' },
      { name: 'AMOUNT', type: 'NUMBER(19,2)', nullable: true, defaultValue: null, comment: '' },
      { name: 'OLD_FLAG', type: 'VARCHAR2(1)', nullable: true, defaultValue: 'N', comment: '' },
    ], { primaryKey: ['ID'], indexes: [{ name: 'IDX_AMT', unique: false, columns: ['AMOUNT'] }], comment: '票据主表' }),
    snapshotObject('ONLY_SIT', [{ name: 'A', type: 'NUMBER(10)', nullable: true, defaultValue: null, comment: '' }]),
  ])
  const uat = snapshot('UAT', [
    snapshotObject('BILL_MAIN', [
      { name: 'ID', type: 'NUMBER(19)', nullable: false, defaultValue: null, comment: '主键' },
      { name: 'AMOUNT', type: 'NUMBER(19,2)', nullable: false, defaultValue: '0', comment: '' },
      { name: 'NEW_FLAG', type: 'VARCHAR2(1)', nullable: true, defaultValue: 'Y', comment: '新标志' },
    ], { primaryKey: ['ID'], indexes: [], comment: '票据主表' }),
    snapshotObject('ONLY_UAT', [{ name: 'B', type: 'DATE', nullable: true, defaultValue: null, comment: '' }]),
  ])

  const result = compareSnapshots(sit, uat)
  assert.deepEqual(result.summary, { leftCount: 2, rightCount: 2, onlyLeft: 1, onlyRight: 1, changed: 1, identical: 0 })
  const bill = result.diffs.find(diff => diff.name === 'BILL_MAIN')!
  const text = bill.lines.join('\n')
  assert.match(text, /\+ 字段 NEW_FLAG VARCHAR2\(1\)/)
  assert.match(text, /- 字段 OLD_FLAG VARCHAR2\(1\)/)
  assert.match(text, /~ 字段 AMOUNT 可空 是 → 否/)
  assert.match(text, /~ 字段 AMOUNT 默认值 （无） → 0/)
  assert.match(text, /- 索引 IDX_AMT\(右侧缺失\)|- 索引 IDX_AMT（右侧缺失）/)
  assert.match(bill.ddlLeft, /CREATE TABLE "OB_USER"\."BILL_MAIN"/)
  assert.match(bill.ddlLeft, /"AMOUNT" NUMBER\(19,2\)/)
  assert.match(bill.ddlRight, /"AMOUNT" NUMBER\(19,2\) DEFAULT 0 NOT NULL/)
  assert.match(bill.ddlRight, /CONSTRAINT "PK_BILL_MAIN" PRIMARY KEY \("ID"\)/)

  // 只看差异时，结构一致的对象不应出现在结果里；打开开关才出现
  const identical = snapshot('SIT2', [snapshotObject('SAME', [{ name: 'A', type: 'NUMBER(10)', nullable: true, defaultValue: null, comment: '' }])])
  assert.equal(compareSnapshots(identical, snapshot('UAT2', identical.objects)).diffs.length, 0)
  assert.equal(compareSnapshots(identical, snapshot('UAT2', identical.objects), { includeIdentical: true }).diffs[0]?.identical, true)
})

test('DDL comparison flags view definition changes and builds view DDL', () => {
  const view = (text: string): SchemaSnapshot => snapshot('X', [
    snapshotObject('V_BILL', [{ name: 'ID', type: 'NUMBER(19)', nullable: true, defaultValue: null, comment: '' }], { type: 'VIEW', viewText: text }),
  ])
  const result = compareSnapshots(view('SELECT id FROM bill'), view('SELECT id, amount FROM bill'))
  assert.equal(result.summary.changed, 1)
  assert.match(result.diffs[0]!.lines.join('\n'), /视图定义不同/)
  assert.match(result.diffs[0]!.ddlLeft, /CREATE OR REPLACE VIEW "OB_USER"\."V_BILL" AS/)
  assert.match(result.diffs[0]!.ddlRight, /SELECT id, amount FROM bill/)
})

test('DDL comparison config: environments come from the file and never expose passwords', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wt-ddl-'))
  const file = join(dir, 'ddl-environments.json')
  writeFileSync(file, JSON.stringify({
    environments: [
      { key: 'SIT', name: '示例环境-sit', host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER', tenant: 'obtenant_sit', user: 'OB_USER', password: 'test-only-password' },
      { key: 'UAT', name: '示例环境-uat', host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER', tenant: 'obtenant_uat', user: 'OB_USER_UAT', password: 'test-only-password' },
    ],
  }))
  process.env.DDL_ENV_CONFIG = file
  try {
    const loaded = loadEnvironments()
    assert.equal(loaded.path, file)
    assert.deepEqual(loaded.environments.map(env => env.key), ['SIT', 'UAT'])
    assert.equal(loaded.environments[0]!.schema, 'OB_USER', 'schema 留空时取用户名')
    assert.equal(loaded.environments[1]!.tenant, 'obtenant_uat')
    const display = environmentsForDisplay() as { environments: Record<string, unknown>[] }
    assert.deepEqual(display.environments.map(env => env.hasPassword), [true, true])
    assert.doesNotMatch(JSON.stringify(display), /test-only-password/, '给页面的清单里不能出现密码')
    assert.doesNotMatch(JSON.stringify(display), /password/, '连密码字段名都不应出现')
  } finally {
    delete process.env.DDL_ENV_CONFIG
    await rm(dir, { recursive: true, force: true })
  }

  // DDL_ENV_CONFIG 指向不存在的文件、且 $DSH_HOME 下也没有配置时，回落到包内自带的 config/ddl-environments.json
  process.env.DDL_ENV_CONFIG = join(tmpdir(), 'not-exists-ddl-config.json')
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'wt-dshhome-'))
  try {
    const fallback = loadEnvironments()
    assert.ok(fallback.path?.endsWith('config/ddl-environments.json'), `应回落到包内配置，实际 ${fallback.path}`)
    assert.deepEqual(fallback.environments.slice(0, 2).map(env => env.key), ['SIT', 'UAT'])
    const [sit] = fallback.environments
    assert.ok(sit!.host.length > 0 && sit!.tenant.length > 0 && sit!.user.length > 0, '包内默认配置要能直接读出环境信息')
    // 提交到仓库的模板必须是可用 JSON，且不含真实凭据
    const example = JSON.parse(readFileSync(new URL('../config/ddl-environments.example.json', import.meta.url), 'utf8')) as { environments: { password: string }[] }
    assert.equal(example.environments.length, 2)
    assert.ok(example.environments.every(env => env.password === 'YOUR_PASSWORD'), '模板里只能是占位密码')
  } finally {
    delete process.env.DDL_ENV_CONFIG
    const home = process.env.DSH_HOME
    delete process.env.DSH_HOME
    if (home) await rm(home, { recursive: true, force: true })
  }
})

test('snapshot reading normalises Oracle uppercase dictionary keys', async () => {
  // 回归：Oracle 把未加引号的列名/别名折叠成大写，若不归一化，字段名会全部读成 undefined
  const connection = {
    query: async (sql: string) => {
      if (/FROM all_tables/i.test(sql)) return [[{ NAME: 'T1', KIND: 'TABLE', COMMENTS: '测试表' }], []]
      if (/all_tab_columns/i.test(sql)) return [[
        { TABLE_NAME: 'T1', COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER', DATA_PRECISION: 19, DATA_SCALE: 0, NULLABLE: 'N', DATA_DEFAULT: null, COMMENTS: '主键' },
        { TABLE_NAME: 'T1', COLUMN_NAME: 'NAME', DATA_TYPE: 'VARCHAR2', DATA_LENGTH: 60, NULLABLE: 'Y', DATA_DEFAULT: null, COMMENTS: '' },
      ], []]
      if (/all_constraints/i.test(sql)) return [[{ TABLE_NAME: 'T1', CONSTRAINT_NAME: 'PK_T1', CONSTRAINT_TYPE: 'P', COLUMN_NAME: 'ID' }], []]
      if (/all_indexes/i.test(sql)) return [[{ TABLE_NAME: 'T1', INDEX_NAME: 'PK_T1', UNIQUENESS: 'UNIQUE', COLUMN_NAME: 'ID' }], []]
      if (/all_views/i.test(sql)) return [[], []]
      return [[], []]
    },
  }
  const environment = { key: 'SIT', name: 'sit', host: 'h', port: 2883, cluster: '', tenant: 't1', user: 'U', password: 'p', schema: 'U', enabled: true }
  const snapshot = await readSnapshot(environment, connection as never)
  assert.equal(snapshot.objects.length, 1)
  const object = snapshot.objects[0]!
  assert.equal(object.comment, '测试表')
  assert.deepEqual(object.columns.map(column => `${column.name} ${column.type}${column.nullable ? '' : ' NOT NULL'}`), ['ID NUMBER(19) NOT NULL', 'NAME VARCHAR2(60)'])
  assert.equal(object.columns[0]!.comment, '主键')
  assert.deepEqual(object.primaryKey, ['ID'])
  assert.deepEqual(object.indexes, [], '主键自带的索引不参与索引比较')
})

test('DDL comparison names the failing side instead of a bare auth error', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wt-ddl2-'))
  const file = join(dir, 'ddl-environments.json')
  // 第二套（UAT）的账号是错的：模拟认证失败
  writeFileSync(file, JSON.stringify({
    environments: [
      { key: 'SIT', name: 'sit', host: '127.0.0.1', port: 65000, cluster: 'C', tenant: 'obtenant_sit', user: 'OB_USER', password: 'p' },
      { key: 'UAT', name: 'uat', host: '127.0.0.1', port: 65000, cluster: 'C', tenant: 'obtenant_uat', user: 'OB_USER_UAT', password: 'p' },
    ],
  }))
  process.env.DDL_ENV_CONFIG = file
  try {
    // 连不上库时：错误里必须出现环境标识与可执行建议，且带结构化明细
    await assert.rejects(runComparison({}), (error: OceanBaseError) => {
      assert.match(error.message, /SIT（sit）连接失败/)
      assert.match(error.message, /UAT（uat）连接失败/)
      assert.match(error.message, /user \/ tenant \/ cluster \/ password/)
      const details = error.details as { left: { key: string; ok: boolean }; right: { key: string; ok: boolean }; path: string }
      assert.equal(details.left.key, 'SIT')
      assert.equal(details.right.key, 'UAT')
      assert.equal(details.left.ok, false)
      assert.equal(details.path, file)
      return true
    })
  } finally {
    delete process.env.DDL_ENV_CONFIG
    await rm(dir, { recursive: true, force: true })
  }
})
