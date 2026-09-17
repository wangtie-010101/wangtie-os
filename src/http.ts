/**
 * 王铁 OS — 最小 HTTP 工具集：JSON 序列化、同源校验、带上限的 JSON body 读取。
 * 所有 /wangtie-os/api/* 路由共用这套工具（写法对齐 dshmarket/src/http.ts）。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** 写一个 no-store 的 JSON 响应。 */
export function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

/** 仅接受同源 POST：Origin 与 Host 一致。 */
export function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** 读取并解析 JSON body，超过 maxBytes 直接拒绝。 */
export async function readJsonBody(request: IncomingMessage, maxBytes = 1 << 20): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) { request.resume(); throw new Error('request body too large') }
    chunks.push(buffer)
  }
  if (chunks.length === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/** 从 URL 中取 query 参数（容错，非法 URL 返回空字符串）。 */
export function queryOf(request: IncomingMessage, key: string): string {
  try {
    return new URL(request.url ?? '', 'http://localhost').searchParams.get(key) ?? ''
  } catch {
    return ''
  }
}
