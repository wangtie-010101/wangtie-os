/**
 * 王铁 OS — OceanBase **Oracle 兼容模式**数据访问层。
 *
 * 关键事实（踩过坑后确认）：
 *   - OceanBase 的 Oracle 兼容模式是**租户兼容模式**（SQL 方言是 Oracle），
 *     但**线协议仍是 MySQL 协议**：OceanBase Connector/J（com.oceanbase.jdbc.Driver）本身就是
 *     MariaDB Connector/J 的分支。ODP 的 2883 不会回应 Oracle 协议（TNS）的连接，
 *     实测 8 种 TNS 写法服务端一个字节都不回 → 所以这里用 mysql2 连、SQL 全写 Oracle 方言。
 *   - 元数据：Oracle 数据字典 ALL_USERS / ALL_TABLES / ALL_TAB_COLUMNS / ALL_CONSTRAINTS；
 *   - 标识符：双引号 "NAME"（不是反引号），大小写敏感；
 *   - 绑定变量：:p1 命名绑定（mysql2 namedPlaceholders），日期用 TO_DATE/TO_TIMESTAMP 显式转换；
 *   - 分页：ROWNUM 包一层；行标识：有主键用主键，没有主键的堆表用 ROWID（视图只读）；
 *   - 空串即 NULL；无 BOOLEAN 列类型；NUMBER 一律按字符串读取，避免大数精度丢失。
 */

import mysql from 'mysql2/promise'
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { testTcpReachability, type TcpProbeResult } from './dbprobe.ts'

export class OceanBaseError extends Error {
  constructor(
    message: string,
    public status = 400,
    public uncertain = false,
    public code = '',
    /** 结构化明细（例如 DDL 比较里两套环境各自的连接结果），会原样透给页面。 */
    public details?: unknown,
  ) { super(message) }
}

type ObjectValue = Record<string, unknown>
/** Oracle 绑定值：文本、数字、NULL（Oracle 没有布尔列类型）。 */
type SqlValue = string | number | null

/** 只允许 Oracle 兼容模式的租户（MySQL 模式请改用 obclient / 官方 JDBC）。 */
const TENANT_MODE = 'oracle'
/** 默认端口：ODP/OBProxy 2883（直连 observer 才是 2881）。 */
const DEFAULT_PORT = 2883

/**
 * 传输协议标识（页面上会显示，便于确认走的是哪条路）。
 * Oracle 兼容模式租户经 ODP 走的就是 MySQL 线协议（OBJDBC 亦然），Oracle 只是 SQL 方言层。
 */
export const TRANSPORT = 'mysql-protocol'
/** 系统模式（只读）。 */
const SYSTEM_SCHEMAS = ['SYS', 'SYSTEM', 'LBACSYS', 'ORAAUDITOR', 'OCEANBASE', 'PUBLIC', 'MDSYS', 'CTXSYS', 'XDB', '__RECYCLEBIN']
/** 二进制列类型（只读，按十六进制展示）。 */
const BINARY_TYPES = /^(BLOB|RAW|LONG RAW|BFILE)/i
/** 大文本列类型（Oracle 的 CLOB 可按文本编辑）。 */
const LOB_TYPES = /^(CLOB|NCLOB|LONG)/i

/* -------------------------------- 入参校验 -------------------------------- */

export function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new OceanBaseError('请求参数必须是对象')
  return value as ObjectValue
}

function required(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || value.includes('\0')) throw new OceanBaseError(`${label}不能为空或格式不正确`)
  return value.trim()
}

/** Oracle 标识符：双引号包裹，内部双引号翻倍。 */
export function identifier(value: string): string { return '"' + value.replace(/"/g, '""') + '"' }

/** 绑定值校验：Oracle 只接受文本 / 数字 / NULL。 */
function scalar(value: unknown): SqlValue {
  if (value === null) return null
  if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) return value
  throw new OceanBaseError('字段值只支持文本、数字和 NULL；二进制字段请使用十六进制文本')
}

/** Oracle 语义：空串等同 NULL，字符串统一 trim 后再比较空。 */
function normalize(value: unknown): SqlValue {
  const checked = scalar(value)
  if (typeof checked === 'string' && checked === '') return null
  return checked
}

function pageNumber(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new OceanBaseError('分页参数无效')
  return n
}

/* -------------------------------- 连接参数 -------------------------------- */

/**
 * 拆解数据库用户名：既接受纯用户名（OB_USER），也接受 OceanBase 客户端的完整写法
 * OB_USER@obtenant_sit#OB_CLUSTER（@ 后是租户，# 后是集群）。
 */
export function parseUser(input: string): { user: string; tenant: string; cluster: string } {
  const [bare = '', rest = ''] = String(input).split('@')
  const [tenant = '', cluster = ''] = rest.split('#')
  return { user: bare.trim(), tenant: tenant.trim(), cluster: cluster.trim() }
}

/** 从 user@租户#集群 里取出租户名。 */
export function tenantOfUser(user: string): string {
  return parseUser(user).tenant
}

/** OceanBase Oracle 模式租户的连接档案（与 OceanBase 客户端「新建数据源」字段一一对应）。 */
export interface ProfileFields {
  host: string
  port: number
  /** 连接后默认使用的模式（Schema）；留空则用账号同名模式，查询里始终带模式限定。 */
  database: string
  /** 完整连接账号：user@租户[#集群]。 */
  user: string
  tenant: string
  cluster: string
  tls: boolean
}

/** mysql2 连接参数（Oracle 兼容模式经 ODP 走 MySQL 线协议）。 */
export interface OracleConnectOptions {
  host: string
  port: number
  user: string
  password: string
  database?: string
  connectTimeout: number
  multipleStatements: false
  namedPlaceholders: true
  supportBigNumbers: true
  bigNumberStrings: true
  dateStrings: true
  charset: string
  ssl?: { rejectUnauthorized: boolean }
}

/** 连接阶段等待上限：比前端 28 秒更短，保证界面能拿到明确错误。 */
export const CONNECT_TIMEOUT_MS = 12_000
/** 连接前的 TCP 可达性预检：先把「网络不通」和「协议握手失败」分开。 */
export const TCP_PRECHECK_MS = 5_000

/**
 * 解析连接参数：字段与 OceanBase 客户端一致（主机/端口/集群名/租户名/用户名/密码），
 * 由服务端拼出 ODP 需要的完整账号 user@租户#集群。
 */
export function resolveProfile(raw: unknown): { fields: ProfileFields; driver: OracleConnectOptions } {
  const profile = object(raw)
  if (profile.mode !== TENANT_MODE) throw new OceanBaseError('仅支持 OceanBase Oracle 兼容模式租户，请确认租户模式后重试')
  const port = profile.port === undefined || profile.port === '' ? DEFAULT_PORT : Number(profile.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new OceanBaseError('端口必须在 1–65535 之间')
  if (typeof profile.password !== 'string') throw new OceanBaseError('请填写数据库密码（允许空密码）')
  const host = required(profile.host, '主机')
  const parsed = parseUser(required(profile.user, '数据库用户名'))
  if (!parsed.user || /[@#\s]/.test(parsed.user)) throw new OceanBaseError('数据库用户名请只填用户名本身（租户名、集群名分开填）')
  const tenantField = typeof profile.tenant === 'string' ? profile.tenant.trim() : ''
  const clusterField = typeof profile.cluster === 'string' ? profile.cluster.trim() : ''
  if (tenantField && parsed.tenant && tenantField !== parsed.tenant) throw new OceanBaseError('租户名与用户名里的租户不一致，请只填一处或保持相同')
  if (clusterField && parsed.cluster && clusterField !== parsed.cluster) throw new OceanBaseError('集群名与用户名里的集群不一致，请只填一处或保持相同')
  const tenant = tenantField || parsed.tenant
  const cluster = clusterField || parsed.cluster
  if (!tenant) throw new OceanBaseError('请填写租户名：连接账号必须是 用户名@租户名#集群名 的形式')
  if (/[@#\s]/.test(tenant)) throw new OceanBaseError('租户名格式不正确（不要带 @ 或 #）')
  if (/[@#\s]/.test(cluster)) throw new OceanBaseError('集群名格式不正确（不要带 @ 或 #）')
  // 「高级设置 → 默认模式」可选：等价于 JDBC URL 里 host:port/ 后面那一段（通常就是用户名）。
  const database = typeof profile.database === 'string' ? profile.database.trim()
    : typeof profile.schema === 'string' ? profile.schema.trim() : ''
  if (database && /[`\s]/.test(database)) throw new OceanBaseError('默认模式名格式不正确（不要带空格或反引号）')
  const user = `${parsed.user}@${tenant}${cluster ? `#${cluster}` : ''}`
  return {
    fields: { host, port, database, user, tenant, cluster, tls: profile.tls === true },
    driver: {
      host,
      port,
      user,
      password: profile.password,
      ...(database ? { database } : {}),
      connectTimeout: CONNECT_TIMEOUT_MS,
      multipleStatements: false,
      namedPlaceholders: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      charset: 'utf8mb4',
      // ODP 默认明文；只有服务端确实启用了 TLS 才勾选。
      ...(profile.tls === true ? { ssl: { rejectUnauthorized: false } } : {}),
    },
  }
}

/** 驱动参数视图（测试与集成脚本使用）。 */
export function connectionOptions(raw: unknown): OracleConnectOptions {
  return resolveProfile(raw).driver
}

/* -------------------------------- 列元数据 -------------------------------- */

export interface Column {
  /** 列名原样（Oracle 未加引号建表时为大写），也是结果集里的键名。 */
  name: string
  /** 展示用类型：VARCHAR2(50) / NUMBER(10,2) / TIMESTAMP(6) / CLOB … */
  type: string
  /** 基础类型名，用于绑定表达式选择。 */
  dataType: string
  nullable: boolean
  defaultValue: string | null
  primary: boolean
  identity: boolean
  virtual: boolean
  /** 二进制列（BLOB/RAW）：只读，十六进制展示。 */
  binary: boolean
  /** 大文本列（CLOB/LONG）：可按文本编辑。 */
  lob: boolean
  comment: string
}

/** 由数据字典字段拼出人类可读的类型，例如 NUMBER(10,2) / VARCHAR2(50 CHAR)。 */
export function displayType(row: ObjectValue): string {
  const type = String(row.data_type ?? '').toUpperCase()
  const charLength = row.char_length === null || row.char_length === undefined ? null : Number(row.char_length)
  const length = row.data_length === null || row.data_length === undefined ? null : Number(row.data_length)
  const precision = row.data_precision === null || row.data_precision === undefined ? null : Number(row.data_precision)
  const scale = row.data_scale === null || row.data_scale === undefined ? null : Number(row.data_scale)
  const charUsed = String(row.char_used ?? '').toUpperCase() === 'C'
  if (/^VARCHAR2|^NVARCHAR2|^CHAR|^NCHAR/.test(type)) {
    const size = charLength ?? length
    return size === null ? type : `${type}(${size}${charUsed ? ' CHAR' : ''})`
  }
  if (/^NUMBER|^FLOAT|^DECIMAL|^NUMERIC/.test(type)) {
    if (precision === null) return type
    return scale === null || scale === 0 ? `${type}(${precision})` : `${type}(${precision},${scale})`
  }
  if (/^RAW/.test(type)) return length === null ? type : `${type}(${length})`
  if (/^TIMESTAMP/.test(type)) {
    const scaleMatch = /\((\d+)\)/.exec(type)
    return scaleMatch ? `TIMESTAMP(${scaleMatch[1]})` : 'TIMESTAMP(6)'
  }
  return type
}

function isBinaryType(type: string): boolean { return BINARY_TYPES.test(type) }
function isLobType(type: string): boolean { return LOB_TYPES.test(type) }

export function columnFrom(row: ObjectValue): Column {
  const dataType = String(row.data_type ?? '').toUpperCase()
  const rawDefault = row.data_default
  const defaultValue = rawDefault === null || rawDefault === undefined ? null : String(rawDefault).trim()
  return {
    name: String(row.column_name),
    type: displayType(row),
    dataType,
    nullable: String(row.nullable ?? '').toUpperCase() === 'Y',
    defaultValue: defaultValue === '' ? null : defaultValue,
    primary: String(row.is_pk ?? '').toUpperCase() === 'Y',
    identity: String(row.identity_column ?? '').toUpperCase() === 'YES',
    virtual: String(row.virtual_column ?? '').toUpperCase() === 'YES',
    binary: isBinaryType(dataType),
    lob: isLobType(dataType),
    comment: String(row.comments ?? ''),
  }
}

/* ------------------------------ 行结果序列化 ------------------------------ */

/** 单个二进制字段最多回传的十六进制长度（超出只保留长度与前缀，避免响应过大）。 */
const BINARY_HEX_LIMIT = 4096

/**
 * 把驱动返回的行转换成可安全 JSON 序列化的对象：
 * Buffer（RAW）转十六进制；BLOB 的 Lob 对象读出内容后再转十六进制；
 * 其余（NUMBER/DATE/CLOB 已按字符串读取）原样返回。
 */
export async function serialRow(row: ObjectValue): Promise<ObjectValue> {
  const entries = await Promise.all(Object.entries(row).map(async ([key, value]) => [key, await serialValue(value)] as const))
  return Object.fromEntries(entries)
}

async function serialValue(value: unknown): Promise<unknown> {
  if (Buffer.isBuffer(value)) return bufferToHex(value)
  if (isLob(value)) {
    try {
      const data = await value.getData()
      if (typeof data === 'string') return bufferToHex(Buffer.from(data, 'utf8'))
      if (Buffer.isBuffer(data)) return bufferToHex(data)
      return bufferToHex(Buffer.from(String(data), 'utf8'))
    } catch {
      return { binaryHex: '', truncated: true, length: Number(value.length ?? 0) }
    } finally {
      // Lob 必须显式关闭，否则连接上会一直挂着游标。
      try { await value.close() } catch { /* 已关闭 */ }
    }
  }
  if (value instanceof Date) return value.toISOString().replace('T', ' ').slice(0, 19)
  return value
}

function bufferToHex(buffer: Buffer): ObjectValue {
  if (buffer.length <= BINARY_HEX_LIMIT) return { binaryHex: buffer.toString('hex') }
  return { binaryHex: buffer.subarray(0, BINARY_HEX_LIMIT).toString('hex'), truncated: true, length: buffer.length }
}

interface LobLike { getData(): Promise<unknown>; close(): Promise<void>; length?: unknown }
function isLob(value: unknown): value is LobLike {
  return typeof value === 'object' && value !== null && typeof (value as LobLike).getData === 'function' && typeof (value as LobLike).close === 'function'
}

/* -------------------------------- 表结构读取 ------------------------------ */

function columnOf(columns: Column[], name: unknown): Column {
  const column = columns.find(item => item.name === name)
  if (!column) throw new OceanBaseError('字段不存在，请刷新表结构')
  return column
}

/**
 * 字段结构查询分三档，从「信息最全」到「最保守」自动降级。
 * 原因：不同版本的 Oracle 兼容字典带的列不一样——例如 OceanBase 3.2 的 ALL_TAB_COLUMNS
 * 没有 12c 才引入的 IDENTITY_COLUMN / VIRTUAL_COLUMN，直接查会报 ORA-00904，
 * 而「行数据」必须先读到字段结构，于是整条查询链断掉。
 */
const COLUMN_SQL_TIERS: readonly string[] = [
  // 档 1：完整（标识列/虚拟列/字符语义 + 注释 + 主键）
  `SELECT c.column_name, c.data_type, c.data_length, c.char_length, c.char_used, c.data_precision, c.data_scale,
          c.nullable, c.data_default, c.identity_column, c.virtual_column, cc.comments,
          CASE WHEN pk.column_name IS NULL THEN 'N' ELSE 'Y' END AS is_pk
     FROM all_tab_columns c
     LEFT JOIN all_col_comments cc
       ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
     LEFT JOIN (SELECT ac.owner, ac.table_name, acc.column_name
                  FROM all_constraints ac
                  JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
                 WHERE ac.constraint_type = 'P') pk
       ON pk.owner = c.owner AND pk.table_name = c.table_name AND pk.column_name = c.column_name
    WHERE c.owner = :p1 AND c.table_name = :p2
    ORDER BY c.column_id`,
  // 档 2：去掉 12c 才有的标识列/虚拟列与字符语义
  `SELECT c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
          c.nullable, c.data_default, cc.comments,
          CASE WHEN pk.column_name IS NULL THEN 'N' ELSE 'Y' END AS is_pk
     FROM all_tab_columns c
     LEFT JOIN all_col_comments cc
       ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
     LEFT JOIN (SELECT ac.owner, ac.table_name, acc.column_name
                  FROM all_constraints ac
                  JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
                 WHERE ac.constraint_type = 'P') pk
       ON pk.owner = c.owner AND pk.table_name = c.table_name AND pk.column_name = c.column_name
    WHERE c.owner = :p1 AND c.table_name = :p2
    ORDER BY c.column_id`,
  // 档 3：最保守——只用最基础的列（连注释表、主键关联都不要）
  `SELECT c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
          c.nullable, c.data_default
     FROM all_tab_columns c
    WHERE c.owner = :p1 AND c.table_name = :p2
    ORDER BY c.column_id`,
]
/** 当前可用的档位，避免每次请求都从失败开始试。 */
let columnSqlTier = 0
/** 字典缺列/缺表类错误：说明该版本的 Oracle 兼容字典与预期不同，可以降级重试。 */
export function isDictionaryGap(error: unknown): boolean {
  const text = `${String((error as { message?: unknown })?.message ?? '')} ${String((error as { sqlMessage?: unknown })?.sqlMessage ?? '')}`
  return /ORA-(?:00904|00942|01722|00932)/.test(text)
}

/** 主键列（按约束里的列顺序，用于拼接 WHERE 与排序兜底）。 */
const PRIMARY_KEY_SQL = `
SELECT acc.column_name
  FROM all_constraints ac
  JOIN all_cons_columns acc
    ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
 WHERE ac.owner = :p1 AND ac.table_name = :p2 AND ac.constraint_type = 'P'
 ORDER BY acc.position`

async function queryRows(connection: Connection, sql: string, binds: Record<string, SqlValue> = {}): Promise<ObjectValue[]> {
  const [rows] = await connection.query<RowDataPacket[]>(sql, binds)
  return (rows ?? []) as unknown as ObjectValue[]
}

/**
 * 数据字典查询的键名归一化：Oracle 把未加引号的列名/别名折叠成大写，
 * 这里统一转成小写再映射，避免依赖具体写法。
 * 只用于元数据查询——数据行必须保留真实列名（大写）以便和列元数据对齐。
 */
function lowerKeys(row: ObjectValue): ObjectValue {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]))
}

async function queryDictionary(connection: Connection, sql: string, binds: Record<string, SqlValue> = {}): Promise<ObjectValue[]> {
  return (await queryRows(connection, sql, binds)).map(lowerKeys)
}

export async function schemasOf(connection: Connection): Promise<string[]> {
  const collect = (rows: ObjectValue[]): string[] => rows.map(row => String(row.name ?? '')).filter(name => name !== '')
  try {
    const rows = await queryDictionary(connection, 'SELECT username AS name FROM all_users ORDER BY username')
    if (rows.length) return collect(rows)
  } catch { /* 无权读 ALL_USERS 时继续往下试 */ }
  try {
    // 退回「我能看到的对象属主」；再不行就用当前账号名兜底，保证下拉框不会空着。
    const owners = await queryDictionary(connection, 'SELECT DISTINCT owner AS name FROM all_tables ORDER BY owner')
    if (owners.length) return collect(owners)
  } catch { /* 忽略，走兜底 */ }
  const current = await queryDictionary(connection, 'SELECT USER AS name FROM DUAL')
  return collect(current)
}

export interface TableEntry { name: string; type: 'TABLE' | 'VIEW'; comment: string }

export async function tablesOf(connection: Connection, schema: string): Promise<TableEntry[]> {
  let rows: ObjectValue[]
  try {
    rows = await queryDictionary(connection, `
      SELECT t.table_name AS name,
             CASE WHEN v.view_name IS NULL THEN 'TABLE' ELSE 'VIEW' END AS kind,
             c.comments AS comments
        FROM all_tables t
        LEFT JOIN all_views v ON v.owner = t.owner AND v.view_name = t.table_name
        LEFT JOIN all_tab_comments c ON c.owner = t.owner AND c.table_name = t.table_name
       WHERE t.owner = :p1
       ORDER BY t.table_name`, { p1: schema })
  } catch (error) {
    if (error instanceof OceanBaseError || !isDictionaryGap(error)) throw error
    // 注释视图/视图字典不可用时的保守写法
    rows = await queryDictionary(connection, 'SELECT table_name AS name FROM all_tables WHERE owner = :p1 ORDER BY table_name', { p1: schema })
  }
  return rows.map(row => ({
    name: String(row.name),
    type: (String(row.kind ?? 'TABLE').toUpperCase() === 'VIEW' ? 'VIEW' : 'TABLE') as 'TABLE' | 'VIEW',
    comment: String(row.comments ?? ''),
  }))
}

export async function columnsFor(connection: Connection, schema: string, table: string): Promise<Column[]> {
  let lastError: unknown
  for (let tier = columnSqlTier; tier < COLUMN_SQL_TIERS.length; tier += 1) {
    try {
      const rows = await queryDictionary(connection, COLUMN_SQL_TIERS[tier]!, { p1: schema, p2: table })
      if (!rows.length) throw new OceanBaseError('表或视图不存在，或当前账号没有访问权限', 404)
      columnSqlTier = tier // 记住这次成功的档位
      return rows.map(columnFrom)
    } catch (error) {
      lastError = error
      // 只有「字典缺列/缺表」才降级；权限、网络、404 等错误直接抛出
      if (!(error instanceof OceanBaseError) && isDictionaryGap(error) && tier < COLUMN_SQL_TIERS.length - 1) continue
      throw error
    }
  }
  throw lastError
}

export async function primaryKeyOf(connection: Connection, schema: string, table: string): Promise<string[]> {
  const rows = await queryDictionary(connection, PRIMARY_KEY_SQL, { p1: schema, p2: table })
  return rows.map(row => String(row.column_name))
}

/* -------------------------------- 行标识策略 ------------------------------ */

export type KeyMode = 'primary' | 'rowid' | 'none'
/** 无主键堆表用 ROWID 定位；该列名由服务端在查询里附加，编辑时原样回传。 */
export const ROWID_FIELD = 'wt_rowid'

export interface KeySpec { mode: KeyMode; columns: string[] }

export function keySpecOf(columns: Column[], tableType: 'TABLE' | 'VIEW'): KeySpec {
  const primary = columns.filter(column => column.primary)
  if (primary.length && !primary.some(column => column.binary)) return { mode: 'primary', columns: primary.map(column => column.name) }
  // 视图没有 ROWID，只有真实堆表才能用 ROWID 定位。
  if (tableType === 'TABLE') return { mode: 'rowid', columns: [ROWID_FIELD] }
  return { mode: 'none', columns: [] }
}

/** 由 key 对象拼出 WHERE 条件（主键逐列相等，或用 ROWID 精确定位一行）。
 *  绑定名统一用 k 前缀，避免和 SET/WERT 子句的 p 前缀绑定相互覆盖。 */
export function keyCondition(spec: KeySpec, key: unknown): { sql: string; binds: Record<string, SqlValue> } {
  if (spec.mode === 'none') throw new OceanBaseError('该对象没有主键且不是可定位的堆表，只能查询', 403)
  const values = object(key)
  if (spec.mode === 'rowid') {
    const rowid = values[ROWID_FIELD]
    if (typeof rowid !== 'string' || rowid.trim() === '') throw new OceanBaseError('缺少 ROWID，请刷新数据后重试')
    return { sql: 'ROWID = :k1', binds: { k1: rowid.trim() } }
  }
  if (Object.keys(values).length !== spec.columns.length) throw new OceanBaseError('必须提供完整主键，拒绝无条件修改或删除')
  const binds: Record<string, SqlValue> = {}
  const parts = spec.columns.map((name, index) => {
    const value = values[name]
    if (value === null || value === undefined) throw new OceanBaseError('必须提供完整主键，拒绝无条件修改或删除')
    binds[`k${index + 1}`] = scalar(value)
    return `${identifier(name)} = :k${index + 1}`
  })
  return { sql: parts.join(' AND '), binds }
}

/* -------------------------------- 值绑定表达式 ---------------------------- */

/**
 * 日期/时间列必须显式转换：Oracle 的隐式转换依赖 NLS_DATE_FORMAT（默认 DD-MON-RR），
 * 会把 'YYYY-MM-DD' 直接判为非法。这里按用户输入自动选择格式。
 */
export function valueExpression(column: Column, bind: string): string {
  const type = column.dataType
  if (/^DATE/.test(type)) {
    return `TO_DATE(${bind}, CASE WHEN INSTR(${bind}, ':') > 0 THEN 'YYYY-MM-DD HH24:MI:SS' ELSE 'YYYY-MM-DD' END)`
  }
  if (/^TIMESTAMP/.test(type)) {
    const fmt = "CASE WHEN INSTR(" + bind + ", '.') > 0 THEN 'YYYY-MM-DD HH24:MI:SS.FF' WHEN INSTR(" + bind + ", ':') > 0 THEN 'YYYY-MM-DD HH24:MI:SS' ELSE 'YYYY-MM-DD' END"
    return `TO_TIMESTAMP(${bind}, ${fmt})`
  }
  return bind
}

/** 写入前的格式校验：NUMBER 列提前拦截非数字，日期列给出明确格式要求。 */
function formatValue(column: Column, label: string, text: string): string {
  if (/^NUMBER|^FLOAT|^DECIMAL|^NUMERIC/.test(column.dataType) && !/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
    throw new OceanBaseError(`${label}需要数字，请检查输入（当前为「${text.slice(0, 32)}」）`)
  }
  if (/^DATE/.test(column.dataType) && !/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(text)) {
    throw new OceanBaseError(`${label}需要日期，格式为 YYYY-MM-DD 或 YYYY-MM-DD HH24:MI:SS`)
  }
  if (/^TIMESTAMP/.test(column.dataType) && !/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(text)) {
    throw new OceanBaseError(`${label}需要时间，格式为 YYYY-MM-DD HH24:MI:SS[.FF]`)
  }
  if (!column.lob && text.length > 4000 && /^(VARCHAR2|NVARCHAR2|CHAR|NCHAR|RAW)/.test(column.dataType)) {
    throw new OceanBaseError(`${label}内容超过 4000 字符，${column.dataType} 无法容纳，请改用 CLOB`)
  }
  return text
}

/** 绑定前校验：先做格式校验，再按 Oracle 语义把空串当 NULL。 */
function prepareValue(column: Column, label: string, value: unknown): SqlValue {
  const normalized = normalize(value)
  if (normalized === null) {
    if (!column.nullable) throw new OceanBaseError(`${label}不能为 NULL（Oracle 模式下空字符串同样视为 NULL）`)
    return null
  }
  return formatValue(column, label, String(normalized))
}

/** 可编辑性判定：虚拟列、标识列、二进制列都不参与写入。 */
export function editableColumn(columns: Column[], name: unknown): Column {
  const column = columnOf(columns, name)
  if (column.virtual) throw new OceanBaseError(`字段 ${column.name} 是虚拟列，不能写入`)
  if (column.identity) throw new OceanBaseError(`字段 ${column.name} 是标识列，请使用「默认值 / 自动生成」`)
  if (column.binary) throw new OceanBaseError(`字段 ${column.name} 是二进制列，不支持文本编辑`)
  return column
}

/* ---------------------------------- 筛选 ---------------------------------- */

export function whereFilter(columns: Column[], raw: unknown): { sql: string; binds: Record<string, SqlValue> } {
  if (raw === undefined || raw === null) return { sql: '', binds: {} }
  const filter = object(raw)
  const column = columnOf(columns, filter.column)
  if (column.binary) throw new OceanBaseError('暂不支持二进制字段筛选')
  const name = identifier(column.name)
  if (filter.op === 'null') return { sql: ` WHERE ${name} IS NULL`, binds: {} }
  if (filter.op === 'notnull') return { sql: ` WHERE ${name} IS NOT NULL`, binds: {} }
  if (filter.op === 'contains') return { sql: ` WHERE INSTR(TO_CHAR(${name}), :p1) > 0`, binds: { p1: String(normalize(filter.value) ?? '') } }
  const ops: Record<string, string> = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
  const op = Object.hasOwn(ops, String(filter.op)) ? ops[String(filter.op)] : undefined
  if (!op) throw new OceanBaseError('筛选操作不支持')
  // 日期/数字先按格式校验，报错比数据库的 ORA-01858 更容易理解；
  // LONG/RAW 无法推断文本格式，保持原样交给数据库。
  const normalized = normalize(filter.value)
  const value = normalized === null || column.lob || /^RAW|^LONG RAW|^BFILE/.test(column.dataType)
    ? normalized
    : formatValue(column, `字段 ${column.name} 的筛选值`, String(normalized))
  return { sql: ` WHERE ${name} ${op} ${valueExpression(column, ':p1')}`, binds: { p1: value } }
}

/* ---------------------------------- 排序 ---------------------------------- */

/** Oracle 默认 ASC 时 NULL 在后、DESC 时 NULL 在前；这里显式声明，避免翻页时行序漂移。 */
export function orderClause(columns: Column[], sort: unknown, direction: unknown, tiebreak: string[]): string {
  const items: string[] = []
  if (sort !== undefined && sort !== null && sort !== '') {
    const column = columnOf(columns, sort)
    const dir = direction === 'desc' ? 'DESC' : 'ASC'
    items.push(`${identifier(column.name)} ${dir} NULLS ${dir === 'DESC' ? 'FIRST' : 'LAST'}`)
  }
  for (const name of tiebreak) {
    if (items.some(item => item.startsWith(identifier(name)))) continue
    items.push(`${identifier(name)} ASC`)
  }
  return items.length ? ` ORDER BY ${items.join(', ')}` : ''
}

/* -------------------------------- OceanBase 管理 --------------------------- */

export interface RowQuery { sql: string; binds: Record<string, SqlValue> }

/**
 * 分页查询：内层排序取数，外层 ROWNUM 过滤。
 * 只要没有主键就附带 ROWID，供无主键堆表定位行。
 */
export function buildRowQuery(target: { schema: string; table: string }, columns: Column[], options: {
  filter?: unknown; sort?: unknown; direction?: unknown; limit: number; offset: number; key: KeySpec
}): RowQuery {
  const filter = whereFilter(columns, options.filter)
  const order = orderClause(columns, options.sort, options.direction, options.key.mode === 'primary' ? options.key.columns : [])
  const needsRowid = options.key.mode === 'rowid'
  const selectList = needsRowid ? `t.*, t.ROWID AS ${identifier(ROWID_FIELD)}` : 't.*'
  const inner = `SELECT ${selectList} FROM ${qualified(target)} t${filter.sql}${order}`
  return {
    sql: `SELECT * FROM (SELECT wt_inner.*, ROWNUM AS ${identifier('wt_rn')} FROM (${inner}) wt_inner WHERE ROWNUM <= :p_max) WHERE ${identifier('wt_rn')} > :p_off`,
    binds: { ...filter.binds, p_max: options.offset + options.limit + 1, p_off: options.offset },
  }
}

export function qualified(target: { schema: string; table: string }): string {
  return `${identifier(target.schema)}.${identifier(target.table)}`
}

/* -------------------------------- 数据写入 -------------------------------- */

/** 全默认值插入：Oracle 没有 INSERT ... () VALUES ()，用每列 DEFAULT 表达。 */
export function defaultInsertSQL(target: { schema: string; table: string }, columns: Column[]): string {
  const insertable = columns.filter(column => !column.virtual)
  if (!insertable.length) throw new OceanBaseError('该对象没有可写入的列')
  return `INSERT INTO ${qualified(target)} (${insertable.map(column => identifier(column.name)).join(', ')}) VALUES (${insertable.map(() => 'DEFAULT').join(', ')})`
}

export function buildInsert(target: { schema: string; table: string }, columns: Column[], rawValues: unknown): RowQuery {
  const values = object(rawValues)
  const names = Object.keys(values)
  if (!names.length) return { sql: defaultInsertSQL(target, columns), binds: {} }
  const binds: Record<string, SqlValue> = {}
  const targets: string[] = []
  const placeholders: string[] = []
  names.forEach((name, index) => {
    const column = editableColumn(columns, name)
    const bind = `:p${index + 1}`
    binds[`p${index + 1}`] = prepareValue(column, `字段 ${column.name}`, values[name])
    targets.push(identifier(column.name))
    placeholders.push(valueExpression(column, bind))
  })
  return { sql: `INSERT INTO ${qualified(target)} (${targets.join(', ')}) VALUES (${placeholders.join(', ')})`, binds }
}

export function buildUpdate(target: { schema: string; table: string }, columns: Column[], spec: KeySpec, body: ObjectValue): RowQuery {
  const values = object(body.values)
  const names = Object.keys(values)
  if (!names.length) throw new OceanBaseError('没有需要修改的字段')
  const binds: Record<string, SqlValue> = {}
  const assignments = names.map((name, index) => {
    const column = editableColumn(columns, name)
    if (column.primary) throw new OceanBaseError(`字段 ${column.name} 是主键，不支持修改`)
    if (!Object.hasOwn(object(body.original), name)) throw new OceanBaseError('缺少字段原值，请刷新后重试')
    const bind = `:p${index + 1}`
    binds[`p${index + 1}`] = prepareValue(column, `字段 ${column.name}`, values[name])
    return `${identifier(column.name)} = ${valueExpression(column, bind)}`
  })
  const key = keyCondition(spec, body.key)
  return { sql: `UPDATE ${qualified(target)} SET ${assignments.join(', ')} WHERE ${key.sql}`, binds: { ...binds, ...key.binds } }
}

export function buildDelete(target: { schema: string; table: string }, spec: KeySpec, body: ObjectValue): RowQuery {
  if (body.confirm !== true) throw new OceanBaseError('请确认删除记录')
  const key = keyCondition(spec, body.key)
  return { sql: `DELETE FROM ${qualified(target)} WHERE ${key.sql}`, binds: key.binds }
}

/**
 * 乐观并发校验：写入前按 key 锁行，逐列比对客户端带回的原值。
 * 虚拟列不参与比对（值由表达式算出，无法回填）。
 */
export async function assertRowUnchanged(
  connection: Connection, target: { schema: string; table: string }, spec: KeySpec,
  columns: Column[], body: ObjectValue,
): Promise<void> {
  const key = keyCondition(spec, body.key)
  const rows = await queryRows(connection, `SELECT * FROM ${qualified(target)} WHERE ${key.sql} FOR UPDATE`, key.binds)
  if (rows.length !== 1) throw new OceanBaseError('记录已被修改或删除，请刷新数据后重试', 409)
  const actual = await serialRow(rows[0]!)
  const original = object(body.original)
  for (const column of columns) {
    if (column.virtual) continue
    if (!Object.hasOwn(original, column.name)) throw new OceanBaseError('原始记录不完整，请刷新数据后重试')
    if (JSON.stringify(actual[column.name] ?? null) !== JSON.stringify(original[column.name] ?? null)) {
      throw new OceanBaseError('记录已被修改或删除，请刷新数据后重试', 409)
    }
  }
}

/* ---------------------------------- 执行 ---------------------------------- */

async function versionInfo(connection: Connection): Promise<ObjectValue> {
  const identity = await queryDictionary(connection, `SELECT USER AS current_user, SYS_CONTEXT('USERENV', 'DB_NAME') AS db_name FROM DUAL`)
  const info: ObjectValue = { currentUser: identity[0]?.current_user ?? '', dbName: identity[0]?.db_name ?? '' }
  try {
    // Oracle 兼容模式租户的版本信息：v$version 需要额外授权，取不到不影响功能。
    const banner = await queryDictionary(connection, 'SELECT banner FROM v$version WHERE ROWNUM = 1')
    info.version = banner[0]?.banner ?? ''
  } catch {
    try {
      const ob = await queryDictionary(connection, 'SELECT version() AS version')
      info.version = String(ob[0]?.version ?? '')
    } catch {
      info.version = ''
    }
  }
  return info
}

export async function perform(connection: Connection, action: string, body: ObjectValue): Promise<ObjectValue> {
  if (action === 'connect') {
    return { info: await versionInfo(connection), schemas: await schemasOf(connection) }
  }
  // 自检：逐条跑字典查询并回报结果，用于快速定位「哪个版本缺了哪张字典/哪个列」
  if (action === 'verify') {
    const checks: { name: string; ok: boolean; detail: string }[] = []
    const push = async (name: string, task: () => Promise<unknown>): Promise<void> => {
      try {
        checks.push({ name, ok: true, detail: String(await task()).slice(0, 200) })
      } catch (error) {
        const failure = error as { code?: unknown; message?: unknown; sqlMessage?: unknown }
        checks.push({ name, ok: false, detail: `${String(failure.code ?? '')} ${String(failure.sqlMessage ?? failure.message ?? error)}`.slice(0, 200) })
      }
    }
    let schemas: string[] = []
    await push('当前账号 (SELECT USER FROM DUAL)', async () => (await queryDictionary(connection, 'SELECT USER AS name FROM DUAL'))[0]?.name ?? '')
    await push('模式列表 (ALL_USERS)', async () => { schemas = await schemasOf(connection); return `${schemas.length} 个：${schemas.slice(0, 6).join(', ')}` })
    await push('版本信息 (v$version)', async () => (await queryDictionary(connection, 'SELECT banner FROM v$version WHERE ROWNUM = 1'))[0]?.banner ?? '')
    const probeSchema = typeof body.schema === 'string' && body.schema.trim() ? body.schema.trim() : (schemas[0] ?? '')
    let firstTable = ''
    await push(`表/视图列表 (ALL_TABLES, 模式 ${probeSchema || '未取到'})`, async () => {
      const entries = await tablesOf(connection, probeSchema)
      firstTable = entries[0]?.name ?? ''
      return `共 ${entries.length} 个对象${firstTable ? `，首个：${firstTable}` : ''}`
    })
    if (firstTable) {
      for (let tier = 0; tier < COLUMN_SQL_TIERS.length; tier += 1) {
        await push(`字段结构·档 ${tier + 1} (${firstTable})`, async () => {
          const rows = await queryDictionary(connection, COLUMN_SQL_TIERS[tier]!, { p1: probeSchema, p2: firstTable })
          return `${rows.length} 列`
        })
      }
      await push(`主键约束 (ALL_CONSTRAINTS, ${firstTable})`, async () => {
        const rows = await queryDictionary(connection, PRIMARY_KEY_SQL, { p1: probeSchema, p2: firstTable })
        return rows.length ? `主键列：${rows.map(row => String(row.column_name)).join(', ')}` : '无主键'
      })
      await push(`行查询 (ROWNUM 分页, ${firstTable})`, async () => {
        const columns = await columnsFor(connection, probeSchema, firstTable)
        const spec = keySpecOf(columns, 'TABLE')
        const query = buildRowQuery({ schema: probeSchema, table: firstTable }, columns, { limit: 2, offset: 0, key: spec })
        const rows = await queryRows(connection, query.sql, query.binds)
        return `返回 ${rows.length} 行，使用档位 ${columnSqlTier + 1}`
      })
    }
    return { checks, columnTier: columnSqlTier + 1, schema: probeSchema }
  }
  const schema = required(body.schema, '模式（Schema）')
  if (action === 'tables') {
    return { tables: await tablesOf(connection, schema) }
  }
  const table = required(body.table, '表名')
  const columns = await columnsFor(connection, schema, table)
  const tables = await tablesOf(connection, schema)
  const entry = tables.find(item => item.name === table)
  const tableType: 'TABLE' | 'VIEW' = entry?.type ?? 'TABLE'
  const writable = tableType === 'TABLE' && !SYSTEM_SCHEMAS.includes(schema.toUpperCase())
  const spec = keySpecOf(columns, tableType)
  const permissions = { insert: writable, edit: writable && spec.mode !== 'none' }

  if (action === 'rows') {
    const limit = pageNumber(body.limit, 50, 200)
    if (!limit) throw new OceanBaseError('每页行数至少为 1')
    const offset = pageNumber(body.offset, 0, 10_000_000)
    const query = buildRowQuery({ schema, table }, columns, { filter: body.filter, sort: body.sort, direction: body.direction, limit, offset, key: spec })
    const rows = await queryRows(connection, query.sql, query.binds)
    const hasMore = rows.length > limit
    const page: ObjectValue[] = []
    for (const row of rows.slice(0, limit)) {
      const serialized = await serialRow(row)
      delete serialized.wt_rn
      page.push(serialized)
    }
    return { columns, rows: page, offset, limit, hasMore, permissions, key: { mode: spec.mode, columns: spec.columns, label: spec.mode === 'rowid' ? 'ROWID' : spec.mode === 'primary' ? '主键' : '无' }, tableType }
  }

  if (!writable) throw new OceanBaseError('仅允许修改普通表；视图和系统模式只读', 403)
  const statement = action === 'insert'
    ? buildInsert({ schema, table }, columns, body.values)
    : action === 'update'
      ? buildUpdate({ schema, table }, columns, spec, body)
      : action === 'delete'
        ? buildDelete({ schema, table }, spec, body)
        : (() => { throw new OceanBaseError('不支持的操作') })()

  await connection.rollback() // 让本连接从干净事务开始
  try {
    if (action !== 'insert') await assertRowUnchanged(connection, { schema, table }, spec, columns, body)
    const [result] = await connection.query<ResultSetHeader>(statement.sql, statement.binds)
    const affected = result.affectedRows ?? 0
    if (affected !== 1) throw new OceanBaseError('记录已被修改或删除，请刷新数据后重试', 409)
    await connection.commit()
    return { affectedRows: affected }
  } catch (error) {
    await connection.rollback().catch(() => { /* 回滚失败时保留原始错误 */ })
    throw error
  }
}

/** 建立连接阶段的失败：还没有发出任何语句，写入结果确定——不能报成「结果未知」。 */
export function connectionFailure(error: unknown, tls = false): OceanBaseError {
  const code = String((error as { code?: unknown })?.code ?? '')
  const detail = `${String((error as { message?: unknown })?.message ?? '')} ${String((error as { sqlMessage?: unknown })?.sqlMessage ?? '')}`
  // 勾了 TLS 却连的是明文端口：这是最常见的误操作，直接点出来。
  if (tls && /tls|ssl|handshake|certificate|secure/i.test(detail)) {
    return new OceanBaseError('TLS/SSL 握手失败：该端口很可能没有启用 TLS。ODP 默认明文，请取消勾选「使用 TLS」后重试', 400, false, code || 'TLS')
  }
  const messages: Record<string, string> = {
    ETIMEDOUT: `连接数据库超时（已等待 ${Math.round(CONNECT_TIMEOUT_MS / 1000)} 秒）：请检查主机、端口与网络策略是否放通`,
    ENOTFOUND: '无法解析数据库主机名，请检查连接地址',
    EAI_AGAIN: '域名解析暂时失败，请检查 DNS 或连接地址',
    ECONNREFUSED: '目标端口拒绝连接：请检查端口是否正确（ODP 2883 / 直连 observer 2881）',
    EHOSTUNREACH: '主机不可达：请检查网络与路由',
    ENETUNREACH: '网络不可达：请检查网络与路由',
    'ER_ACCESS_DENIED_ERROR': '认证失败：账号、租户或密码不正确（账号需写成 用户名@租户名#集群名）',
    'ER_DBACCESS_DENIED_ERROR': '当前账号没有访问该模式的权限',
    PROTOCOL_CONNECTION_LOST: '连接被数据库关闭',
    ECONNRESET: '连接被重置',
    EPIPE: '连接已断开',
  }
  return new OceanBaseError(messages[code] ?? '无法连接数据库，请检查地址、端口、租户名与账号密码', 400, false, code)
}

/** TCP 预检钩子：默认用 Node 原生 TCP 探测，测试里可注入。 */
export type TcpProbe = (host: string, port: number, timeoutMs?: number) => Promise<TcpProbeResult>

/**
 * 打开连接 → 执行 → 关闭。
 * 连接分两层诊断：先用原生 TCP 判断「网络层是否可达」，再走 MySQL 协议握手；
 * 两层原因完全不同（网络策略 vs 账号/租户/端口），分开报才排查得动。
 */
export async function executeOceanBase(action: string, body: ObjectValue, probe: TcpProbe = testTcpReachability): Promise<ObjectValue> {
  const { driver, fields } = resolveProfile(body.connection)
  const reachable = await probe(fields.host, fields.port, TCP_PRECHECK_MS)
  if (!reachable.ok) {
    throw new OceanBaseError(
      `网络层不通：${reachable.detail}。请确认「运行本服务的那台机器」（不是浏览器所在机器）能访问 ${fields.host}:${fields.port}` +
      `——内网策略 / VPN / 防火墙是否对该进程放通。`,
      400, false, reachable.code)
  }
  let connection: Connection | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let connectTimer: ReturnType<typeof setTimeout> | undefined
  try {
    let timedOut = false
    const pending = mysql.createConnection(driver)
      .catch((error: unknown) => { throw connectionFailure(error, fields.tls) })
    // mysql2 的 connectTimeout 只管 TCP 建连；握手阶段仍可能挂住，
    // 这里再兜一层：保证接口总能在前端超时之前给出明确错误。
    connection = await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        connectTimer = setTimeout(() => {
          timedOut = true
          reject(new OceanBaseError(
            `连接数据库超时（已等待 ${Math.round(CONNECT_TIMEOUT_MS / 1000)} 秒）：TCP 已能连上 ${fields.host}:${fields.port}，` +
            `但没有完成 MySQL 协议握手。请确认端口（ODP 2883 / 直连 observer 2881）、账号 ${fields.user} 与网络策略；` +
            `可用 node tools/ob-probe.mjs --variants 一次性核对连接写法。`,
            504, false, 'CONNECT_TIMEOUT'))
        }, CONNECT_TIMEOUT_MS)
      }),
    ])
    // 迟到的连接要主动关掉，避免泄漏。
    void pending.then(late => { if (timedOut) void closeConnection(late) }).catch(() => { /* 已按连接失败处理 */ })
    const active = connection
    const result = await Promise.race([
      perform(active, action, body),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          void closeConnection(active)
          reject(new OceanBaseError('数据库操作超时，请刷新核实结果后再操作', 504, ['insert', 'update', 'delete'].includes(action)))
        }, 15_000)
      }),
    ])
    // 连接结果里带回租户与协议：连的始终是 OceanBase，Oracle 兼容模式租户经 MySQL 线协议访问。
    return action === 'connect'
      ? { ...result, mode: TENANT_MODE, tenant: fields.tenant, cluster: fields.cluster, transport: TRANSPORT, database: fields.database }
      : result
  } finally {
    if (timer) clearTimeout(timer)
    if (connectTimer) clearTimeout(connectTimer)
    if (connection) await closeConnection(connection)
  }
}

/** 正常关闭连接；1 秒内没关掉就强制断开，避免挂住请求。 */
async function closeConnection(connection: Connection): Promise<void> {
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      connection.end(),
      new Promise<void>(resolve => { closeTimer = setTimeout(() => resolve(), 1000) }),
    ])
  } catch {
    /* 连接可能已被超时逻辑销毁。 */
    try { connection.destroy() } catch { /* 已断开 */ }
  } finally {
    if (closeTimer) clearTimeout(closeTimer)
  }
}
