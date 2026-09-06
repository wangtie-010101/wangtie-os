/**
 * 王铁 OS — 静态资源托管。
 * 宿主 webserver 契约：exact/prefix 路由的 path 均为绝对 pathname 且**不带尾斜杠**
 * （prefix 的 path 匹配自身及其子路径）。因此：
 *   - exact  '/wangtie-os'        → ui/index.html
 *   - prefix '/wangtie-os/ui'     → 包内 ui/ 目录（带路径穿越防护）
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registeredPaths, staticDebug, type WebServerService } from './routes.ts'

const UI_DIR = resolve(fileURLToPath(new URL('../ui', import.meta.url)))

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

export function staticDisposers(webServer: WebServerService, routePrefix: string): (() => void)[] {
  staticDebug.called += 1
  const base = routePrefix.replace(/\/$/, '')
  const uiPrefix = `${base}/ui`

  const serveFile = (response: ServerResponse, relative: string): void => {
    const target = resolve(UI_DIR, relative)
    // 路径穿越防护：解析后必须仍在 UI_DIR 内。
    if (target !== UI_DIR && !target.startsWith(UI_DIR + sep)) {
      response.writeHead(403)
      response.end('forbidden')
      return
    }
    if (!existsSync(target) || statSync(target).isDirectory()) {
      response.writeHead(404)
      response.end('not found')
      return
    }
    const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream'
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
    response.end(readFileSync(target))
  }

  /** 由前缀路由进入：取 pathname 相对 uiPrefix 的剩余部分。 */
  const serveRelative = (request: IncomingMessage, response: ServerResponse): void => {
    let pathname = '/'
    try {
      pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    } catch {
      /* fallthrough */
    }
    let relative = pathname.slice(uiPrefix.length)
    if (relative === '' || relative === '/') relative = 'index.html'
    if (relative.startsWith('/')) relative = relative.slice(1)
    serveFile(response, relative)
  }

  registeredPaths.push(`exact:${base}`, `prefix:${uiPrefix}`)

  return [
    webServer.register({
      kind: 'exact',
      path: base,
      handler: (_request, response) => serveFile(response, 'index.html'),
    }),
    webServer.register({
      kind: 'prefix',
      path: uiPrefix,
      handler: serveRelative,
    }),
  ]
}

/** 供测试使用。 */
export { UI_DIR }
