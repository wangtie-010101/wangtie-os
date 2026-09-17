/**
 * 王铁 OS — OceanBase 连接档案（多套连接 + 环境别名）。
 *
 * 存储位置：$DSH_HOME/wangtie-os/connections.json（与 config.json 同目录）。
 * 安全约定：**服务端不落盘密码**——档案里只有地址与账号信息；密码由使用者在连接时输入，
 * 或由页面按需存到"本浏览器"（localStorage），并在界面上明确标注。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { configDir } from './config.ts'
import { OceanBaseError, object, resolveProfile } from './oceanbase.ts'

export interface ConnectionProfile {
  id: string
  /** 显示名，例如「票据库 · 测试」。 */
  name: string
  /** 环境别名：测试 / 准生产 / 生产 / 自定义。 */
  env: string
  host: string
  port: number
  cluster: string
  tenant: string
  user: string
  database: string
  tls: boolean
  updatedAt: string
}

function storeFile(): string {
  return join(configDir(), 'connections.json')
}

export function listProfiles(): ConnectionProfile[] {
  try {
    const raw = JSON.parse(readFileSync(storeFile(), 'utf8')) as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter((item): item is ConnectionProfile => Boolean(item) && typeof item === 'object' && typeof (item as ConnectionProfile).id === 'string')
  } catch {
    return []
  }
}

function writeProfiles(profiles: ConnectionProfile[]): void {
  mkdirSync(configDir(), { recursive: true })
  writeFileSync(storeFile(), JSON.stringify(profiles, null, 2), 'utf8')
}

function text(value: unknown, label: string, max = 64): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new OceanBaseError(`${label}必须是文本`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new OceanBaseError(`${label}过长（最多 ${max} 字）`)
  if (trimmed.includes('\0')) throw new OceanBaseError(`${label}包含非法字符`)
  return trimmed
}

/** 由输入生成稳定 id：同一个地址+账号视为同一条档案，便于覆盖更新。 */
function profileId(host: string, port: number, user: string, tenant: string, cluster: string): string {
  return `${host}:${port}/${user}@${tenant}${cluster ? '#' + cluster : ''}`.toLowerCase()
}

/**
 * 新增或更新一条连接档案。
 * 复用 resolveProfile 做字段校验（账号拼接规则与连接时完全一致），但**丢弃密码**。
 */
export function saveProfile(raw: unknown): ConnectionProfile {
  const input = object(raw)
  const name = text(input.name, '档案名称', 80)
  const env = text(input.env, '环境别名', 40)
  // 用占位密码走一遍真正的连接参数校验，保证存下来的字段一定能连（地址、租户、账号格式等）。
  // 模式固定为 oracle：本模块的连接档案天然属于 Oracle 兼容模式租户。
  const { fields } = resolveProfile({ ...input, mode: 'oracle', password: typeof input.password === 'string' ? input.password : '' })
  // fields.user 是拼接后的完整账号（user@租户#集群），id 里只用其中的裸用户名，避免重复拼接
  const bareUser = fields.user.includes('@') ? fields.user.split('@')[0]! : fields.user
  const id = profileId(fields.host, fields.port, bareUser, fields.tenant, fields.cluster)
  const profile: ConnectionProfile = {
    id,
    name: name || `${fields.tenant || fields.host}`,
    env,
    host: fields.host,
    port: fields.port,
    cluster: fields.cluster,
    tenant: fields.tenant,
    user: bareUser,
    database: fields.database,
    tls: fields.tls,
    updatedAt: new Date().toISOString(),
  }
  const profiles = listProfiles().filter(item => item.id !== id)
  profiles.unshift(profile)
  writeProfiles(profiles)
  return profile
}

export function removeProfile(raw: unknown): { removed: boolean; id: string } {
  const id = text(object(raw).id, '档案 id', 256)
  if (!id) throw new OceanBaseError('缺少档案 id')
  const before = listProfiles()
  const profiles = before.filter(item => item.id !== id)
  writeProfiles(profiles)
  return { removed: profiles.length !== before.length, id }
}

/** 连接档案相关的动作分发（不需要连数据库）。 */
export function handleProfileAction(raw: unknown): Record<string, unknown> {
  const body = object(raw)
  const op = text(body.op, '操作', 20) || 'list'
  if (op === 'list') return { profiles: listProfiles() }
  if (op === 'save') return { profile: saveProfile(body.profile) }
  if (op === 'remove') return removeProfile(body.profile)
  throw new OceanBaseError('连接档案只支持 list / save / remove')
}
