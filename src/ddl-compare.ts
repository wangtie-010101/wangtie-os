/**
 * 王铁 OS — DDL 比较（SIT / UAT 两套环境的表结构差异）。
 *
 * 连接信息不在页面上填，而是放配置文件（页面只显示环境与文件路径，不回传密码）：
 *   1) 环境变量 DDL_ENV_CONFIG 指定的文件
 *   2) $DSH_HOME/wangtie-os/ddl-environments.json（本机配置，从 DSH 宿主访问时改这里最方便）
 *   3) <项目>/config/ddl-environments.local.json（项目内覆盖，建议加到 .gitignore）
 *   4) <项目>/config/ddl-environments.json（包内自带默认值）
 *
 * 比较方式：把两侧的模式快照（对象 + 字段 + 主键 + 索引 + 注释 + 视图定义）从 Oracle 数据字典读出来，
 * 在内存里逐对象比对，并给出「由数据字典重建的 DDL 文本」左右对照。不执行任何 DDL。
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import type { Connection } from 'mysql2/promise'
import { configDir } from './config.ts'
import { OceanBaseError, connectionFailure, connectionOptions, object } from './oceanbase.ts'

/* --------------------------------- 配置读取 -------------------------------- */

export interface DdlEnvironment {
  key: string
  name: string
  host: string
  port: number
  cluster: string
  tenant: string
  user: string
  password: string
  schema: string
  enabled: boolean
}

/** 候选配置路径，按优先级排列；第一个存在的生效。 */
export function configCandidates(): string[] {
  const projectRoot = fileURLToPath(new URL('../', import.meta.url))
  const fromEnv = process.env.DDL_ENV_CONFIG
  return [
    ...(fromEnv ? [fromEnv] : []),
    // $DSH_HOME 下的配置优先：装进 DSH 宿主（/wangtie-os/）时项目目录在 node_modules 里，
    // 把可编辑的配置放在 $DSH_HOME/wangtie-os/ 下更顺手。
    join(configDir(), 'ddl-environments.json'),
    join(projectRoot, 'config', 'ddl-environments.local.json'),
    join(projectRoot, 'config', 'ddl-environments.json'),
  ]
}

export function resolveConfigPath(): string | null {
  for (const candidate of configCandidates()) {
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    } catch { /* 继续找下一个 */ }
  }
  return null
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : fallback
}

/** 读取并校验配置；schema 留空时取用户名（Oracle 里模式名就是账号名）。 */
export function loadEnvironments(): { path: string | null; environments: DdlEnvironment[] } {
  const path = resolveConfigPath()
  if (!path) throw new OceanBaseError(`没有找到 DDL 比较的配置文件。请创建 config/ddl-environments.json（可参考包内模板），或用环境变量 DDL_ENV_CONFIG 指定路径。`, 400)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new OceanBaseError(`配置文件解析失败（${path}）：${(error as Error).message}`, 400)
  }
  const list = Array.isArray((raw as { environments?: unknown })?.environments) ? (raw as { environments: unknown[] }).environments : []
  const environments = list.map((item, index) => {
    const env = object(item)
    const user = text(env.user)
    const key = text(env.key) || `ENV${index + 1}`
    return {
      key,
      name: text(env.name) || key,
      host: text(env.host),
      port: env.port === undefined || env.port === '' ? 2883 : Number(env.port),
      cluster: text(env.cluster),
      tenant: text(env.tenant),
      user,
      password: typeof env.password === 'string' ? env.password : '',
      schema: (text(env.schema) || user.split('@')[0] || '').toUpperCase(),
      enabled: env.enabled !== false,
    } satisfies DdlEnvironment
  })
  if (environments.length < 2) throw new OceanBaseError(`配置文件里至少要有两个环境才能比较（当前 ${environments.length} 个）：${path}`, 400)
  return { path, environments }
}

/** 给页面看的环境清单：**不含密码**。 */
export function environmentsForDisplay(): Record<string, unknown> {
  const { path, environments } = loadEnvironments()
  let updatedAt = ''
  try { updatedAt = path ? statSync(path).mtime.toISOString() : '' } catch { /* 忽略 */ }
  return {
    path,
    updatedAt,
    environments: environments.map(env => ({
      key: env.key, name: env.name, host: env.host, port: env.port, cluster: env.cluster,
      tenant: env.tenant, user: env.user, schema: env.schema, enabled: env.enabled, hasPassword: env.password !== '',
    })),
  }
}

/* --------------------------------- 结构快照 -------------------------------- */

export interface SnapshotColumn { name: string; type: string; nullable: boolean; defaultValue: string | null; comment: string }
export interface SnapshotIndex { name: string; unique: boolean; columns: string[] }
export interface SnapshotObject {
  name: string
  type: 'TABLE' | 'VIEW'
  comment: string
  columns: SnapshotColumn[]
  primaryKey: string[]
  indexes: SnapshotIndex[]
  /** 视图定义（all_views.text），普通表为空。 */
  viewText: string
}
export interface SchemaSnapshot { environment: string; schema: string; objects: SnapshotObject[]; warnings: string[] }

/** 参数化查询：与主模块一致，mysql2 + Oracle 方言 SQL。 */
async function rows(connection: Connection, sql: string, binds: Record<string, string | number | null>): Promise<Record<string, unknown>[]> {
  const [result] = await connection.query(sql, binds)
  const list = (Array.isArray(result) ? result : []) as unknown as Record<string, unknown>[]
  // Oracle 把未加引号的列名/别名折叠成大写，这里统一转小写再按小写键读取，
  // 否则 TABLE_NAME/COLUMN_NAME 之类会读成 undefined。
  return list.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])))
}

/** 由字典字段拼出可读类型（与主模块 displayType 保持一致的规则）。 */
function typeOf(row: Record<string, unknown>): string {
  const type = String(row.data_type ?? '').toUpperCase()
  const charLength = row.char_length === null || row.char_length === undefined ? null : Number(row.char_length)
  const length = row.data_length === null || row.data_length === undefined ? null : Number(row.data_length)
  const precision = row.data_precision === null || row.data_precision === undefined ? null : Number(row.data_precision)
  const scale = row.data_scale === null || row.data_scale === undefined ? null : Number(row.data_scale)
  if (/^VARCHAR2|^NVARCHAR2|^CHAR|^NCHAR/.test(type)) { const size = charLength ?? length; return size === null ? type : `${type}(${size})` }
  if (/^NUMBER|^FLOAT|^DECIMAL|^NUMERIC/.test(type)) {
    if (precision === null) return type
    return scale === null || scale === 0 ? `${type}(${precision})` : `${type}(${precision},${scale})`
  }
  if (/^RAW/.test(type)) return length === null ? type : `${type}(${length})`
  if (/^TIMESTAMP/.test(type)) { const match = /\((\d+)\)/.exec(type); return match ? `TIMESTAMP(${match[1]})` : 'TIMESTAMP(6)' }
  return type
}

/** 读取一个环境的模式快照：对象、字段、主键、索引、视图定义。 */
export async function readSnapshot(environment: DdlEnvironment, connection: Connection): Promise<SchemaSnapshot> {
  const schema = environment.schema
  const warnings: string[] = []
  const withBinds = { p1: schema }

  const objectRows = await rows(connection, `
    SELECT t.table_name AS name,
           CASE WHEN v.view_name IS NULL THEN 'TABLE' ELSE 'VIEW' END AS kind,
           c.comments AS comments
      FROM all_tables t
      LEFT JOIN all_views v ON v.owner = t.owner AND v.view_name = t.table_name
      LEFT JOIN all_tab_comments c ON c.owner = t.owner AND c.table_name = t.table_name
     WHERE t.owner = :p1
     ORDER BY t.table_name`, withBinds)

  const columnRows = await rows(connection, `
    SELECT c.table_name, c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
           c.nullable, c.data_default, cc.comments
      FROM all_tab_columns c
      LEFT JOIN all_col_comments cc
        ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
     WHERE c.owner = :p1
     ORDER BY c.table_name, c.column_id`, withBinds)

  const keyRows = await rows(connection, `
    SELECT ac.table_name, ac.constraint_name, ac.constraint_type, acc.column_name
      FROM all_constraints ac
      JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
     WHERE ac.owner = :p1 AND ac.constraint_type = 'P'
     ORDER BY ac.table_name, acc.position`, withBinds)

  let indexRows: Record<string, unknown>[] = []
  try {
    indexRows = await rows(connection, `
      SELECT i.table_name, i.index_name, i.uniqueness, ic.column_name
        FROM all_indexes i
        JOIN all_ind_columns ic ON ic.index_owner = i.owner AND ic.index_name = i.index_name
       WHERE i.owner = :p1
       ORDER BY i.table_name, i.index_name, ic.column_position`, withBinds)
  } catch (error) {
    warnings.push(`索引信息读取失败（已跳过索引比较）：${String((error as Error).message).slice(0, 120)}`)
  }

  let viewRows: Record<string, unknown>[] = []
  try {
    viewRows = await rows(connection, 'SELECT view_name, text FROM all_views WHERE owner = :p1', withBinds)
  } catch { warnings.push('视图定义读取失败（已跳过视图 SQL 比较）') }

  const pkNames = new Set(keyRows.map(row => String(row.constraint_name)))
  const objects = new Map<string, SnapshotObject>()
  for (const row of objectRows) {
    const name = String(row.name)
    objects.set(name, { name, type: String(row.kind) === 'VIEW' ? 'VIEW' : 'TABLE', comment: String(row.comments ?? ''), columns: [], primaryKey: [], indexes: [], viewText: '' })
  }
  for (const row of columnRows) {
    const target = objects.get(String(row.table_name))
    if (!target) continue
    target.columns.push({
      name: String(row.column_name),
      type: typeOf(row),
      nullable: String(row.nullable ?? '').toUpperCase() === 'Y',
      defaultValue: row.data_default === null || row.data_default === undefined ? null : String(row.data_default).trim() || null,
      comment: String(row.comments ?? ''),
    })
  }
  for (const row of keyRows) {
    const target = objects.get(String(row.table_name))
    if (target && !target.primaryKey.includes(String(row.column_name))) target.primaryKey.push(String(row.column_name))
  }
  for (const row of indexRows) {
    const target = objects.get(String(row.table_name))
    if (!target) continue
    const indexName = String(row.index_name)
    if (pkNames.has(indexName)) continue // 主键自带的索引不重复比较
    let index = target.indexes.find(item => item.name === indexName)
    if (!index) { index = { name: indexName, unique: String(row.uniqueness) === 'UNIQUE', columns: [] }; target.indexes.push(index) }
    index.columns.push(String(row.column_name))
  }
  for (const row of viewRows) {
    const target = objects.get(String(row.view_name))
    if (target) target.viewText = String(row.text ?? '').replace(/\s+/g, ' ').trim()
  }
  return { environment: `${environment.key}（${environment.name}）`, schema, objects: [...objects.values()], warnings }
}

/** 连一次、读一份快照、断开。 */
export async function snapshotOf(environment: DdlEnvironment): Promise<SchemaSnapshot> {
  const driver = connectionOptions({
    mode: 'oracle', host: environment.host, port: environment.port, cluster: environment.cluster,
    tenant: environment.tenant, user: environment.user, password: environment.password,
  })
  const connection = await mysql.createConnection(driver)
  try {
    // 连接串里带了密码，查询时不需要再指定模式（SQL 全部用 :p1 限定属主）
    return await readSnapshot(environment, connection)
  } finally {
    await connection.end().catch(() => connection.destroy())
  }
}

/* ---------------------------------- 差异计算 -------------------------------- */

export type DiffKind = 'only-left' | 'only-right' | 'changed'
export interface ObjectDiff {
  name: string
  type: 'TABLE' | 'VIEW'
  kind: DiffKind
  identical: boolean
  lines: string[]
  ddlLeft: string
  ddlRight: string
}

/** 重建一份「由数据字典还原」的 DDL 文本，用于左右对照（不保证与建表语句逐字一致）。 */
export function buildDDL(schema: string, item: SnapshotObject): string {
  const quote = (value: string): string => `"${value.replace(/"/g, '""')}"`
  if (item.type === 'VIEW') {
    return [`-- 视图 ${schema}.${item.name}`, `CREATE OR REPLACE VIEW ${quote(schema)}.${quote(item.name)} AS`, `${item.viewText || '（取不到视图定义）'};`].join('\n')
  }
  const lines: string[] = [`CREATE TABLE ${quote(schema)}.${quote(item.name)} (`]
  const parts = item.columns.map(column => {
    const bits = [`  ${quote(column.name)} ${column.type}`]
    if (column.defaultValue !== null) bits.push(`DEFAULT ${column.defaultValue}`)
    if (!column.nullable) bits.push('NOT NULL')
    return bits.join(' ')
  })
  if (item.primaryKey.length) parts.push(`  CONSTRAINT ${quote(`PK_${item.name}`)} PRIMARY KEY (${item.primaryKey.map(quote).join(', ')})`)
  lines.push(parts.join(',\n'), ');')
  if (item.comment) lines.push(`COMMENT ON TABLE ${quote(schema)}.${quote(item.name)} IS '${item.comment.replace(/'/g, "''")}';`)
  for (const column of item.columns) {
    if (column.comment) lines.push(`COMMENT ON COLUMN ${quote(schema)}.${quote(item.name)}.${quote(column.name)} IS '${column.comment.replace(/'/g, "''")}';`)
  }
  for (const index of item.indexes) {
    lines.push(`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${quote(index.name)} ON ${quote(schema)}.${quote(item.name)} (${index.columns.map(quote).join(', ')});`)
  }
  return lines.join('\n')
}

function sameJson(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right) }

/** 逐对象比较两份快照。 */
export function compareSnapshots(left: SchemaSnapshot, right: SchemaSnapshot, options: { includeIdentical?: boolean } = {}): {
  summary: { leftCount: number; rightCount: number; onlyLeft: number; onlyRight: number; changed: number; identical: number }
  diffs: ObjectDiff[]
  warnings: string[]
} {
  const leftMap = new Map(left.objects.map(item => [item.name, item]))
  const rightMap = new Map(right.objects.map(item => [item.name, item]))
  const names = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort()
  const diffs: ObjectDiff[] = []

  for (const name of names) {
    const before = leftMap.get(name)
    const after = rightMap.get(name)
    if (before && !after) {
      diffs.push({ name, type: before.type, kind: 'only-left', identical: false, lines: [`只在左侧（${left.environment}）存在，右侧没有这个对象`], ddlLeft: buildDDL(left.schema, before), ddlRight: '' })
      continue
    }
    if (!before && after) {
      diffs.push({ name, type: after.type, kind: 'only-right', identical: false, lines: [`只在右侧（${right.environment}）存在，左侧没有这个对象`], ddlLeft: '', ddlRight: buildDDL(right.schema, after) })
      continue
    }
    if (!before || !after) continue
    const lines: string[] = []
    if (before.type !== after.type) lines.push(`~ 对象类型 ${before.type} → ${after.type}`)
    if (before.type === 'VIEW' && after.type === 'VIEW' && before.viewText !== after.viewText) {
      lines.push('~ 视图定义不同（见下方 DDL 对照）')
    }
    if (before.comment !== after.comment) lines.push(`~ 表注释 ${before.comment || '（空）'} → ${after.comment || '（空）'}`)

    const leftColumns = new Map(before.columns.map(column => [column.name, column]))
    const rightColumns = new Map(after.columns.map(column => [column.name, column]))
    for (const column of after.columns) {
      if (!leftColumns.has(column.name)) lines.push(`+ 字段 ${column.name} ${column.type}${column.nullable ? '' : ' NOT NULL'}（右侧新增）`)
    }
    for (const column of before.columns) {
      if (!rightColumns.has(column.name)) lines.push(`- 字段 ${column.name} ${column.type}（右侧缺失）`)
    }
    for (const column of before.columns) {
      const counterpart = rightColumns.get(column.name)
      if (!counterpart) continue
      if (column.type !== counterpart.type) lines.push(`~ 字段 ${column.name} 类型 ${column.type} → ${counterpart.type}`)
      if (column.nullable !== counterpart.nullable) lines.push(`~ 字段 ${column.name} 可空 ${column.nullable ? '是' : '否'} → ${counterpart.nullable ? '是' : '否'}`)
      if ((column.defaultValue ?? '') !== (counterpart.defaultValue ?? '')) lines.push(`~ 字段 ${column.name} 默认值 ${column.defaultValue ?? '（无）'} → ${counterpart.defaultValue ?? '（无）'}`)
      if (column.comment !== counterpart.comment) lines.push(`~ 字段 ${column.name} 注释 ${column.comment || '（空）'} → ${counterpart.comment || '（空）'}`)
    }
    if (!sameJson(before.primaryKey, after.primaryKey)) {
      lines.push(`~ 主键 (${before.primaryKey.join(', ') || '无'}) → (${after.primaryKey.join(', ') || '无'})`)
    }
    const leftIndexes = new Map(before.indexes.map(index => [index.name, index]))
    const rightIndexes = new Map(after.indexes.map(index => [index.name, index]))
    for (const index of after.indexes) {
      if (!leftIndexes.has(index.name)) lines.push(`+ 索引 ${index.name}${index.unique ? ' UNIQUE' : ''} (${index.columns.join(', ')})（右侧新增）`)
    }
    for (const index of before.indexes) {
      const counterpart = rightIndexes.get(index.name)
      if (!counterpart) { lines.push(`- 索引 ${index.name}（右侧缺失）`); continue }
      if (!sameJson(index, counterpart)) lines.push(`~ 索引 ${index.name} (${index.columns.join(', ')})${index.unique ? ' UNIQUE' : ''} → (${counterpart.columns.join(', ')})${counterpart.unique ? ' UNIQUE' : ''}`)
    }

    const identical = lines.length === 0
    if (identical && !options.includeIdentical) continue
    diffs.push({
      name,
      type: after.type,
      kind: identical ? 'changed' : 'changed',
      identical,
      lines: identical ? ['两侧结构完全一致'] : lines,
      ddlLeft: buildDDL(left.schema, before),
      ddlRight: buildDDL(right.schema, after),
    })
  }

  const onlyLeft = diffs.filter(diff => diff.kind === 'only-left').length
  const onlyRight = diffs.filter(diff => diff.kind === 'only-right').length
  const identical = diffs.filter(diff => diff.identical).length
  return {
    summary: { leftCount: left.objects.length, rightCount: right.objects.length, onlyLeft, onlyRight, changed: diffs.length - onlyLeft - onlyRight - identical, identical },
    diffs,
    warnings: [...left.warnings, ...right.warnings],
  }
}

/* ---------------------------------- 对外动作 -------------------------------- */

export interface EnvironmentStatus {
  key: string
  name: string
  schema: string
  ok: boolean
  /** 失败原因（已翻译成中文）。 */
  error?: string
  code?: string
  objectCount?: number
}

/** 把驱动错误翻译成中文，并尽量保留 ORA 错误号，便于判断是「认证」还是「字典/权限」问题。 */
function errorText(error: unknown): { error: string; code: string } {
  const failure = error as { code?: unknown; sqlMessage?: unknown; message?: unknown }
  const rawCode = String(failure.code ?? '')
  const text = `${String(failure.sqlMessage ?? '')} ${String(failure.message ?? '')}`
  const ora = /ORA-(\d{5})/.exec(text)
  if (ora) return { error: `数据库返回 ORA-${ora[1]}：${text.trim().slice(0, 160)}`, code: `ORA-${ora[1]}` }
  const mapped = connectionFailure(error)
  return { error: mapped.message, code: mapped.code || rawCode }
}

/** 读一个环境的快照并附带状态；失败不抛，交给调用方决定怎么报。 */
async function snapshotWithStatus(environment: DdlEnvironment): Promise<{ status: EnvironmentStatus; snapshot?: SchemaSnapshot }> {
  const base = { key: environment.key, name: environment.name, schema: environment.schema }
  try {
    const snapshot = await snapshotOf(environment)
    return { status: { ...base, ok: true, objectCount: snapshot.objects.length }, snapshot }
  } catch (error) {
    return { status: { ...base, ok: false, ...errorText(error) } }
  }
}

/** 逐套环境测连接（页面「测试两个环境」按钮）：分别报告账号/字典是否可用。 */
export async function testEnvironments(): Promise<Record<string, unknown>> {
  const { path, environments } = loadEnvironments()
  const usable = environments.filter(env => env.enabled)
  const results = await Promise.all(usable.map(environment => snapshotWithStatus(environment)))
  return { path, environments: results.map(item => item.status) }
}

/** 页面入口：比较两个模式；某一侧失败时会指明是哪一侧、什么原因。 */
export async function runComparison(raw: unknown): Promise<Record<string, unknown>> {
  const body = object(raw)
  const { path, environments } = loadEnvironments()
  const usable = environments.filter(env => env.enabled)
  if (usable.length < 2) throw new OceanBaseError('配置文件里需要至少两个 enabled 的环境', 400)
  const left = usable[0]!
  const right = usable[1]!
  const filter = typeof body.filter === 'string' ? body.filter.trim().toUpperCase() : ''
  const includeViews = body.includeViews !== false
  const includeIdentical = body.includeIdentical === true

  // 两侧独立执行：一侧失败也能明确告诉用户是哪一侧、为什么
  const [leftRead, rightRead] = await Promise.all([snapshotWithStatus(left), snapshotWithStatus(right)])
  if (!leftRead.status.ok || !rightRead.status.ok) {
    const failed = [leftRead.status, rightRead.status].filter(status => !status.ok)
    const ok = [leftRead.status, rightRead.status].filter(status => status.ok)
    const message = [
      failed.map(status => `${status.key}（${status.name}）连接失败：${status.error}`).join('；'),
      ok.length ? `另一侧可正常读取：${ok.map(status => `${status.key} ${status.objectCount} 个对象`).join('、')}` : '',
      `请检查配置文件里的 user / tenant / cluster / password：${path ?? '（未找到配置文件）'}`,
    ].filter(Boolean).join('；')
    throw new OceanBaseError(message, 400, false, failed[0]?.code ?? '', {
      left: leftRead.status, right: rightRead.status, path,
    })
  }

  const filtered = [leftRead.snapshot!, rightRead.snapshot!].map(snapshot => ({
    ...snapshot,
    objects: snapshot.objects.filter(item => (includeViews || item.type === 'TABLE') && (!filter || item.name.includes(filter))),
  })) as [SchemaSnapshot, SchemaSnapshot]
  const result = compareSnapshots(filtered[0], filtered[1], { includeIdentical })
  return {
    left: { key: left.key, name: left.name, schema: left.schema, host: left.host, objects: filtered[0].objects.length },
    right: { key: right.key, name: right.name, schema: right.schema, host: right.host, objects: filtered[1].objects.length },
    statuses: { left: leftRead.status, right: rightRead.status },
    filter,
    ...result,
  }
}
