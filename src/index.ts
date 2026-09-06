/**
 * 王铁 OS — DeepSeek Harness 宿主插件入口。
 *
 * 作为 bundle 插件进入 web profile 后，loader 会加载本包 main（lib/index.js）
 * 并调用 apply(ctx, config)。插件在此处获取 webServer 服务并挂载全部
 * /wangtie-os/api/* 路由；客户端 SPA 由 web 壳按 dsh.client 声明挂载。
 */

import type { Context } from '@deepseek-ai/cordis'
import { mountRoutes, noteMountError, type RouteHost } from './routes.ts'
import { staticDisposers } from './static.ts'

/** 插件 ID（与 cordis.patch.yml 的 insert id 一致）。 */
export const name = 'wangtie-os'

/** 可选 profile 覆盖配置（见 cordis.patch.yml 的 config 示例）。 */
export interface Config {
  /** API/UI 路由前缀，默认 /wangtie-os。 */
  readonly routePrefix?: string
  /** 应用展示名，默认「王铁 OS」。 */
  readonly appName?: string
  /** 应用版本号。 */
  readonly appVersion?: string
}

export function apply(ctx: Context, config?: Config): void {
  // 仅当 web 壳的 webServer 服务就绪时才挂载路由；无 web 的 profile 下自动跳过。
  ctx.inject(['webServer'], (hostCtx: Context) => {
    const host = hostCtx as unknown as RouteHost
    const options = {
      routePrefix: config?.routePrefix ?? '/wangtie-os',
      appName: config?.appName ?? '王铁 OS',
      appVersion: config?.appVersion ?? '0.1.0-rc.1',
    }
    host.effect(() => {
      const disposers: (() => void)[] = []
      // 两段挂载相互隔离：任一段失败不阻塞另一段，错误原样暴露到 health。
      try {
        disposers.push(...mountRoutes(host, options))
      } catch (error) {
        noteMountError('api', String(error))
      }
      try {
        disposers.push(...staticDisposers(host.webServer, options.routePrefix))
      } catch (error) {
        noteMountError('static', String(error))
      }
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, `${name}: http routes`)
  })
}
