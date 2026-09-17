/**
 * 王铁 OS — 数据库连接探测。
 * 用 Node 原生 TCP 直连目标 地址:端口，判断网络层是否可达（真实校验）。
 * 说明：用户名/密码的协议级认证需要对应数据库驱动（mysql/oracledb/pg…），
 * 本演示先验证「地址连通性」，凭据校验在接入真实查询网关后由网关完成。
 */

import { connect } from 'node:net'

/** 常用数据库类型（与前端下拉保持一致）。 */
export type DbKind = 'oracle' | 'mysql' | 'postgresql' | 'sqlserver' | 'dm' | 'kingbase' | 'oceanbase'

export const DB_KINDS: readonly DbKind[] = ['oracle', 'mysql', 'postgresql', 'sqlserver', 'dm', 'kingbase', 'oceanbase']

/** 各类型默认端口：Oracle 1521 / MySQL 3306 / PostgreSQL 5432 / SQLServer 1433 / 达梦 5236 / 人大金仓 54321 / OceanBase 2881 */
export const DB_DEFAULT_PORTS: Record<DbKind, number> = {
  oracle: 1521,
  mysql: 3306,
  postgresql: 5432,
  sqlserver: 1433,
  dm: 5236,
  kingbase: 54321,
  oceanbase: 2881,
}

export interface DbProfileInput {
  readonly type?: string
  readonly host?: string
  readonly port?: number | string
  readonly dbName?: string
  readonly username?: string
  readonly password?: string
}

/** 解析端口：优先用传入端口，为空/非法时回退到该类型的默认端口。返回 null 表示无有效端口。 */
export function resolveDbPort(profile: DbProfileInput): number | null {
  const kind = (profile.type ?? '') as DbKind
  let port: number
  if (profile.port === undefined || profile.port === null || String(profile.port).trim() === '') {
    port = DB_DEFAULT_PORTS[kind] ?? DB_DEFAULT_PORTS.mysql
  } else {
    port = Number(profile.port)
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return port
}

export interface TcpProbeResult {
  readonly ok: boolean
  readonly code: string
  readonly detail: string
  readonly ms: number
}

/** TCP 连通性测试：connect 成功即判定可达；超时/拒绝/域名解析失败等均返回失败并附原因。 */
export async function testTcpReachability(host: string, port: number, timeoutMs = 3000): Promise<TcpProbeResult> {
  const started = Date.now()
  return new Promise<TcpProbeResult>((resolve) => {
    const socket = connect({ host, port })
    let settled = false

    const finish = (ok: boolean, code: string, detail: string): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve({ ok, code, detail, ms: Date.now() - started })
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true, 'OK', `TCP 连接成功（${host}:${port}），端口可达`))
    socket.once('timeout', () => finish(false, 'ETIMEDOUT', `连接超时（${timeoutMs}ms），目标主机无响应或防火墙拦截`))
    socket.once('error', (error: NodeJS.ErrnoException) => {
      const code = error.code ?? 'ERROR'
      const messages: Record<string, string> = {
        ECONNREFUSED: '目标端口拒绝连接（未监听或未开放）',
        ENOTFOUND: '无法解析主机名',
        EHOSTUNREACH: '主机不可达（网络/路由问题）',
        ENETUNREACH: '网络不可达',
      }
      finish(false, code, messages[code] ?? `连接失败：${error.message}`)
    })
  })
}
