/**
 * 王铁 OS — HTTP API 路由集合。
 * 每个 module 一段：health / config / knowledge / sql / agent / dictionary / metadata。
 * 全部为 Mock 实现，接入真实环境时替换各 handler 内部调用即可。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { queryOf, readJsonBody, sendJson } from './http.ts'
import { loadConfig, saveConfig, type WangtieConfig } from './config.ts'
import {
  AGENT_REPORTS, DICTIONARY, ENVIRONMENTS, KNOWLEDGE_DOCS, SERVICES, TABLES, VERSIONS,
  type AgentReport, type Column, type DictEntry, type Environment, type KnowledgeDoc, type TableMeta,
} from './data.ts'
import { resolveDbPort, testTcpReachability } from './dbprobe.ts'
import { mountOceanBase } from './oceanbase-routes.ts'
import { code2session, decryptWeixinData, loadWeRunMap, saveWeRunEntry, todayStepsFromWeRun } from './werun.ts'

export interface WebServerService {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  }): () => void
}

export interface RouteHost {
  webServer: WebServerService
  logger?: { info?(message: string): void; warn?(message: string): void }
}

export interface WangtieOptions {
  readonly routePrefix: string
  readonly appName: string
  readonly appVersion: string
}

/** 演示用内存态：检索新增的报告 / 导入的字典项。 */
const liveReports: AgentReport[] = [...AGENT_REPORTS]
const liveDict: DictEntry[] = [...DICTIONARY]
let dictCursor = DICTIONARY.length

/** 环境差异（演示「表结构比对」）：表中针对不同环境的列差异。 */
const ENV_OVERRIDES: Record<string, Partial<Record<Environment, { drop?: readonly string[]; change?: Record<string, Partial<Column>> }>>> = {
  WLC_FROZEN_APPRO_DETAIL: {
    SIT: {
      drop: ['BIZ_TYPE'],
      change: { ACQUIS_CHAN_CD: { type: 'VARCHAR2(16)', comment: '发起渠道编码（SIT 放宽为 16 位）' } },
    },
  },
}

function envColumns(env: Environment, table: TableMeta): readonly Column[] {
  const override = ENV_OVERRIDES[table.name]?.[env]
  if (override === undefined) return table.columns
  const drop = new Set(override.drop ?? [])
  return table.columns
    .filter(column => !drop.has(column.name))
    .map(column => ({ ...column, ...(override.change?.[column.name] ?? {}) }))
}

function jsonParseSafe(text: string): unknown {
  try { return JSON.parse(text) } catch { return null }
}

/** 已注册路径清单（诊断用，health 返回）。 */
export const registeredPaths: string[] = []

/** 调试计数：staticDisposers 是否被调用（health 返回）。 */
export const staticDebug = { called: 0 }
/** 调试信息：本模块实际加载路径（health 返回）。 */
export const debugModulePath = fileURLToPath(import.meta.url)

/** 挂载错误记录（health 返回，逐段隔离）。 */
export const mountState = { apiError: '', staticError: '' }
export function noteMountError(section: 'api' | 'static', message: string): void {
  if (section === 'api') mountState.apiError = message
  else mountState.staticError = message
}

export function mountRoutes(host: RouteHost, options: WangtieOptions): (() => void)[] {
  const route = options.routePrefix.replace(/\/$/, '')
  const disposers: (() => void)[] = []
  const seen = new Set<string>()
  const on = (path: string, handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>): void => {
    // 宿主对重复 (kind, path) 注册直接 throw；重复注册会让后续路由全部丢失。
    if (seen.has(path)) {
      throw new Error(`wangtie-os: duplicate route ${path} — 合并 handler 按 method/参数分发，不要重复注册`)
    }
    seen.add(path)
    registeredPaths.push(`${route}${path}`)
    disposers.push(host.webServer.register({ kind: 'exact', path: `${route}${path}`, handler }))
  }
  const log = host.logger?.info ?? (() => { /* noop */ })

  /* ------------------------------ health ------------------------------ */
  on('/api/health', (_req, res) => {
    sendJson(res, 200, {
      ok: true, name: options.appName, version: options.appVersion,
      routes: [...registeredPaths],
      debug: { modulePath: debugModulePath, staticCalled: staticDebug.called, mountState },
    })
  })

  /* ------------------------- app / environment ------------------------ */
  on('/api/app-info', (_req, res) => {
    sendJson(res, 200, {
      name: options.appName,
      version: options.appVersion,
      environments: ENVIRONMENTS,
      services: SERVICES.map(service => ({ name: service.name, cn: service.cn, instances: service.instances })),
    })
  })

  on('/api/environments', (_req, res) => {
    sendJson(res, 200, ENVIRONMENTS)
  })

  on('/api/services', (req, res) => {
    const env = (queryOf(req, 'env') || 'DEV') as Environment
    sendJson(res, 200, SERVICES.map(service => ({ name: service.name, cn: service.cn, runtime: service.runtime[env] ?? null })))
  })

  /* ------------------------------ config ------------------------------ */
  // 同一路径合并为一个路由（宿主对重复 (kind, path) 注册会抛错），按 method 分发。
  on('/api/config', (req, res) => {
    if (req.method === 'GET') {
      const config = loadConfig()
      sendJson(res, 200, config)
      return
    }
    if (req.method !== 'PUT') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }
    void readJsonBody(req).then((raw) => {
      const config = { ...loadConfig(), ...(jsonParseSafe(JSON.stringify(raw)) as Partial<WangtieConfig> ?? {}) }
      saveConfig(config)
      sendJson(res, 200, { ok: true, config })
    }).catch((error: unknown) => sendJson(res, 400, { error: String(error) }))
  })

  /* ------------------------- db 连接测试 ------------------------------ */
  // 自定义数据库连接：仅验证目标 地址:端口 的真实可达性（TCP 探测）。
  on('/api/db/test', (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    void readJsonBody(req).then((raw) => {
      const body = (raw ?? {}) as import('./dbprobe.ts').DbProfileInput
      const host = String(body.host ?? '').trim()
      if (host === '') {
        sendJson(res, 400, { ok: false, error: 'host（数据库地址）不能为空' })
        return
      }
      const port = resolveDbPort(body)
      if (port === null) {
        sendJson(res, 400, { ok: false, error: '端口无效（1-65535），或未提供且无该类型默认端口' })
        return
      }
      void testTcpReachability(host, port, 3000).then((result) => {
        sendJson(res, 200, { ok: result.ok, code: result.code, ms: result.ms, detail: result.detail, host, port, type: body.type ?? 'mysql' })
      })
    }).catch((error: unknown) => sendJson(res, 400, { ok: false, error: String(error) }))
  })

  /* ---------------------- 微信运动（小程序通道） -------------------------- */
  // 小程序端 POST：{ code, encryptedData, iv }（wx.login + wx.getWeRunData）
  on('/api/werun/sync', (req, res) => {
    if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
    void readJsonBody(req).then((raw) => {
      const body = (raw ?? {}) as { code?: string; encryptedData?: string; iv?: string }
      if (!body.code || !body.encryptedData || !body.iv) {
        sendJson(res, 400, { ok: false, error: '缺少 code / encryptedData / iv' }); return
      }
      void code2session(body.code).then((session) => {
        if (session.errcode || !session.session_key) {
          sendJson(res, 400, { ok: false, error: session.errmsg ?? 'code2session 失败' }); return
        }
        try {
          const data = decryptWeixinData(body.encryptedData!, session.session_key, body.iv!) as { stepInfoList?: Array<{ timestamp: number; step: number }> }
          const { date, steps } = todayStepsFromWeRun(data)
          if (date) saveWeRunEntry(date, steps)
          sendJson(res, 200, { ok: true, date, steps, openid: session.openid ?? '' })
        } catch (error) {
          sendJson(res, 400, { ok: false, error: '解密失败：' + String(error) })
        }
      }).catch((error: unknown) => sendJson(res, 400, { ok: false, error: String(error) }))
    }).catch((error: unknown) => sendJson(res, 400, { ok: false, error: String(error) }))
  })

  // 王铁 OS 健康减重：读取最近同步的步数
  on('/api/health/werun/latest', (_req, res) => {
    const map = loadWeRunMap()
    const dates = Object.keys(map).sort()
    const date = dates[dates.length - 1]
    if (!date) { sendJson(res, 200, { ok: true, synced: false }); return }
    sendJson(res, 200, { ok: true, synced: true, date, steps: map[date] })
  })

  /* ---------------------------- knowledge ----------------------------- */
  on('/api/knowledge/docs', (_req, res) => {
    sendJson(res, 200, KNOWLEDGE_DOCS.map(({ id, title, category, summary }) => ({ id, title, category, summary })))
  })

  on('/api/knowledge/search', (req, res) => {
    const q = queryOf(req, 'q').trim()
    if (q === '') {
      sendJson(res, 200, { answer: '请输入要检索的问题。', citations: [], tables: [] })
      return
    }
    const terms = q.split(/\s+/).filter(Boolean)
    const scored = KNOWLEDGE_DOCS.map((doc) => {
      const corpus = [doc.title, doc.summary, ...doc.paragraphs].join('\n').toLowerCase()
      const score = terms.reduce((acc, term) => acc + (corpus.includes(term.toLowerCase()) ? 1 : 0), 0)
      return { doc, score }
    }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score)

    if (scored.length === 0) {
      sendJson(res, 200, {
        answer: `票据知识库中未找到与「${q}」相关的文档，请尝试更换关键词，或浏览知识库全量文档。`,
        citations: [],
        tables: [],
      })
      return
    }
    const best = scored[0]!
    if (!best) return
    sendJson(res, 200, {
      answer: best.doc.paragraphs.join('\n\n'),
      citations: scored.map(({ doc, score }) => ({ id: doc.id, title: doc.title, category: doc.category, score })),
      tables: best.doc.tables ?? [],
      docId: best.doc.id,
    })
  })

  /* ------------------------------- sql -------------------------------- */
  function detectTable(sql: string): TableMeta | undefined {
    const match = /\bfrom\s+([a-z_][a-z0-9_]*)/i.exec(sql.replace(/[\r\n]/g, ' '))
    if (match === null) return undefined
    const name = match[1]!.toUpperCase()
    return TABLES.find(table => table.name === name)
  }

  on('/api/sql/tables', (_req, res) => {
    sendJson(res, 200, TABLES.map(table => ({ name: table.name, cn: table.cn, domain: table.domain })))
  })

  on('/api/sql/query', (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }
    void readJsonBody(req).then((raw) => {
      const body = (raw ?? {}) as { sql?: string; env?: string }
      const sql = (body.sql ?? '').trim()
      if (sql === '') {
        sendJson(res, 400, { error: 'empty sql' })
        return
      }
      const table = detectTable(sql)
      const costMs = 3 + Math.floor(Math.random() * 40)
      if (table === undefined) {
        sendJson(res, 200, {
          env: body.env ?? 'DEV',
          sql, table: null, costMs,
          columns: [], rows: [], message: '未识别到表名（Mock 查询），接入真实数据源后由 SQL 网关执行。',
        })
        return
      }
      const columns = table.columns.map(column => ({ name: column.name, cn: column.cn, type: column.type }))
      const rows = Array.from({ length: 8 }, (_, i) => Object.fromEntries(table.columns.map(column => (
        [column.name, column.type.startsWith('NUMBER') ? (i + 1) * 100 : `${column.name.slice(0, 4)}${i + 1}`]
      ))))
      sendJson(res, 200, { env: body.env ?? 'DEV', sql, table: table.name, costMs, columns, rows, truncated: rows.length >= 8 })
    }).catch((error: unknown) => sendJson(res, 400, { error: String(error) }))
  })

  /* ------------------------------- agent ------------------------------ */
  on('/api/agent/log-search', (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }
    void readJsonBody(req).then((raw) => {
      const body = (raw ?? {}) as { env?: string; instance?: string; keyword?: string }
      const keyword = (body.keyword ?? '').trim()
      if (keyword === '') {
        sendJson(res, 400, { error: 'keyword required' })
        return
      }
      const env = (body.env ?? 'DEV') as Environment
      const instance = body.instance ?? 'scb-online'
      const hits = 3 + Math.floor(Math.random() * 6)
      const steps = [
        { step: '1 下载日志', detail: `下载 ${instance}_20260828.log（518.6 KB，按需截取）`, cost: '1.2s' },
        { step: '2 关键字检索', detail: `命中关键字 ${keyword} 共 ${hits} 处（上下各 5 行上下文）`, cost: '0.8s' },
        { step: '3 去噪', detail: '过滤心跳/常规日志 2 处，保留异常上下文', cost: '0.3s' },
        { step: '4 异常链分析', detail: '识别 1 条异常链，1 类报错', cost: '3.1s' },
        { step: '5 生成报告', detail: '已保存到历史分析报告', cost: '0.4s' },
      ]
      const report: AgentReport = {
        id: `rep-live-${Date.now()}`,
        keyword, env, instance,
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        costMs: 5800,
        logSize: '518.6 KB',
        hits,
        exception: '开户网点编码不能为空',
        errorType: 'com.bbbd.dal.core.exception.TransactionException',
        suggestion: '报错链：开户网点编码不能为空，校验服务请求入参网点编码缺失等原因。请上送网点编码（ccnMemberOrCustCd 等字段）到字段；在请求报文 XML 中补充网点编码。',
        relatedErrors: [
          `TRANSACTION_EXCEPTION: WLC_TRANSACTION_EXCEPTION: ${keyword}(1)`,
          'TRANSACTION_INVALID: com.bbbd.dal.core.exception.TransactionException: 开户网点编码不能为空',
        ],
        codeSnippet: [
          '042  if (StringUtils.isBlank(acquirerId)) {',
          '043    throw new TransactionException("TRANSACTION_EXCEPTION", "开户网点编码不能为空");',
          '044  }',
        ],
      }
      liveReports.unshift(report)
      sendJson(res, 200, { steps, costMs: report.costMs, report })
    }).catch((error: unknown) => sendJson(res, 400, { error: String(error) }))
  })

  // 列表与详情合并为一个路由（宿主不允许同路径重复注册），按查询参数分发。
  on('/api/agent/reports', (req, res) => {
    const id = queryOf(req, 'id')
    if (id === '') {
      sendJson(res, 200, liveReports)
      return
    }
    const report = liveReports.find(item => item.id === id)
    if (report === undefined) {
      sendJson(res, 404, { error: 'report not found' })
      return
    }
    sendJson(res, 200, report)
  })

  /* ---------------------------- dictionary ---------------------------- */
  on('/api/dictionary/entries', (req, res) => {
    const q = queryOf(req, 'q').trim().toLowerCase()
    const category = queryOf(req, 'category')
    const entries = liveDict.filter(entry => (
      (category === '' || entry.category === category)
      && (q === '' || entry.cn.toLowerCase().includes(q) || entry.en.toLowerCase().includes(q) || entry.code.toLowerCase().includes(q))
    ))
    sendJson(res, 200, { total: liveDict.length, entries })
  })

  on('/api/dictionary/categories', (_req, res) => {
    sendJson(res, 200, [...new Set(liveDict.map(entry => entry.category))])
  })

  on('/api/dictionary/import', (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }
    void readJsonBody(req).then((raw) => {
      const body = (raw ?? {}) as { payload?: string }
      const lines = (body.payload ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      const parsed: DictEntry[] = lines.map((line) => {
        const [cn, en, code, value, category = '导入'] = line.split(/[,，\t]/).map(part => (part ?? '').trim())
        return {
          id: ++dictCursor, cn: cn ?? '', en: en ?? '', code: code ?? '', value: value ?? '', category,
          source: '手动导入', version: `IMPORT-${new Date().toISOString().slice(0, 10)}`,
        }
      }).filter(entry => entry.code !== '')
      liveDict.unshift(...parsed)
      sendJson(res, 200, { ok: true, imported: parsed.length, entries: parsed })
    }).catch((error: unknown) => sendJson(res, 400, { error: String(error) }))
  })

  /* ----------------------------- metadata ----------------------------- */
  on('/api/metadata/tables', (req, res) => {
    const env = (queryOf(req, 'env') || 'DEV') as Environment
    sendJson(res, 200, TABLES.map(table => ({
      name: table.name, cn: table.cn, domain: table.domain, fieldCount: envColumns(env, table).length,
    })))
  })

  on('/api/metadata/table', (req, res) => {
    const env = (queryOf(req, 'env') || 'DEV') as Environment
    const name = queryOf(req, 'name').toUpperCase()
    const table = TABLES.find(item => item.name === name)
    if (table === undefined) {
      sendJson(res, 404, { error: 'table not found' })
      return
    }
    sendJson(res, 200, { name: table.name, cn: table.cn, domain: table.domain, columns: envColumns(env, table) })
  })

  on('/api/metadata/compare', (req, res) => {
    const a = (queryOf(req, 'a') || 'DEV') as Environment
    const b = (queryOf(req, 'b') || 'SIT') as Environment
    const name = queryOf(req, 'name').toUpperCase()
    const table = TABLES.find(item => item.name === name)
    if (table === undefined) {
      sendJson(res, 404, { error: 'table not found' })
      return
    }
    const ca = envColumns(a, table)
    const cb = envColumns(b, table)
    const mapA = new Map(ca.map(column => [column.name, column]))
    const mapB = new Map(cb.map(column => [column.name, column]))
    const aOnly = ca.filter(column => !mapB.has(column.name))
    const bOnly = cb.filter(column => !mapA.has(column.name))
    const typeDiffs = ca.filter(column => mapB.get(column.name)?.type !== column.type)
    sendJson(res, 200, { table: table.name, a, b, aOnly, bOnly, typeDiffs, aCount: ca.length, bCount: cb.length })
  })

  on('/api/metadata/versions', (req, res) => {
    const env = (queryOf(req, 'env') || 'DEV') as Environment
    sendJson(res, 200, VERSIONS.filter(version => version.env === env))
  })

  on('/api/metadata/alter-sql', (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }
    void readJsonBody(req).then((raw) => {
      const body = (raw ?? {}) as { table?: string; changes?: { kind?: string; field?: string; cn?: string; type?: string }[] }
      const table = (body.table ?? '').toUpperCase()
      if (table === '' || !Array.isArray(body.changes)) {
        sendJson(res, 400, { error: 'table and changes required' })
        return
      }
      const sql = body.changes.map((change) => {
        const field = (change.field ?? '').toUpperCase()
        const type = change.type ?? 'VARCHAR2(32)'
        if (!field) return null
        if (change.kind === 'modify') return `ALTER TABLE ${table} MODIFY (${field} ${type}${change.cn ? ` /* ${change.cn} */` : ''});`
        return `ALTER TABLE ${table} ADD (${field} ${type}${change.cn ? ` /* ${change.cn} */` : ''});`
      }).filter((line): line is string => line !== null)
      sendJson(res, 200, { table, sql })
    }).catch((error: unknown) => sendJson(res, 400, { error: String(error) }))
  })

  disposers.push(...mountOceanBase(host, route))
  log(`${options.appName}: mounted ${disposers.length} routes under ${route}`)
  return disposers
}

/** 供客户端使用：暴露文档全集（知识库「浏览」用）。 */
export function knowledgeDocs(): readonly KnowledgeDoc[] {
  return KNOWLEDGE_DOCS
}
