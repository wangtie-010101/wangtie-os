/**
 * 王铁 OS — 配置存储。
 * 存储于 $DSH_HOME/wangtie-os/config.json（默认 ~/.dsh/wangtie-os/config.json）。
 * 不涉及密钥的字段直接落盘；密码类字段仅存当前会话内存（演示用，生产请接 dsh-settings 服务）。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export interface ServiceRuntime {
  readonly workspace: string
  readonly workload: string
  readonly container: string
  readonly logPath: string
  readonly database: string
  readonly host: string
  readonly port: number
  readonly user: string
  readonly schema: string
  /** 密码不入盘：运行时由用户通过设置页提供。 */
  readonly passwordRef?: string
}

export interface WangtieConfig {
  /** CCE 平台账号（演示字段）。 */
  readonly cceUser?: string
  /** 本地代码路径。 */
  readonly codePath?: string
  /** 服务 → 环境 → 运行参数。 */
  readonly services?: Record<string, Record<string, ServiceRuntime>>
}

export const DEFAULTS: WangtieConfig = {
  cceUser: '',
  codePath: '',
}

/** 解析 DSH_HOME（缺省 ~/.dsh）。 */
export function dshHome(): string {
  return resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'))
}

export function configDir(): string {
  return join(dshHome(), 'wangtie-os')
}

export function configFile(): string {
  return join(configDir(), 'config.json')
}

export function loadConfig(): WangtieConfig {
  try {
    const raw = JSON.parse(readFileSync(configFile(), 'utf8')) as Partial<WangtieConfig>
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveConfig(config: WangtieConfig): void {
  mkdirSync(configDir(), { recursive: true })
  writeFileSync(configFile(), JSON.stringify(config, null, 2), 'utf8')
}
