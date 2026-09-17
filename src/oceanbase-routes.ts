/**
 * 王铁 OS — OceanBase（Oracle 兼容模式）HTTP 路由。
 * 动作：connect / verify（自检）/ profiles（连接档案）/ ddl-environments（DDL 比较的环境清单）/
 *      ddl-test（两套环境分别测连接）/ ddl-compare（SIT↔UAT 结构比较）/ tables / rows / insert / update / delete。
 * 只接受同源 JSON POST；错误一律翻译成中文，不回显 SQL、账号或原始行数据。
 */

import type { RouteHost } from './routes.ts'
import { readJsonBody, sendJson } from './http.ts'
import { executeOceanBase, object, OceanBaseError } from './oceanbase.ts'
import { handleProfileAction } from './connections.ts'
import { environmentsForDisplay, runComparison, testEnvironments } from './ddl-compare.ts'

/** Oracle 错误号 → 可读原因（ORA-xxxxx 的后四位）。 */
const ORACLE_ERRORS: Record<number, string> = {
  1: '主键或唯一约束冲突：该值已存在',
  54: '记录正被其他会话锁定，请稍后重试',
  904: '字段或对象名无效，请刷新表结构后重试',
  942: '表或视图不存在，或当前账号没有访问权限',
  1013: '数据库操作超时（请求被取消），请刷新核实结果',
  1017: '认证失败：用户名、租户或密码不正确',
  1031: '当前账号权限不足，无法执行此操作',
  1034: '当前账号权限不足，无法执行此操作',
  1400: '必填字段不能为 NULL',
  1407: '必填字段不能更新为 NULL',
  1427: '插入的值过多或过少，请刷新表结构后重试',
  1438: '字段值超出该列允许的范围',
  1722: '字段值与列类型不匹配（该列需要数字）',
  1843: '日期格式不正确，请使用 YYYY-MM-DD 或 YYYY-MM-DD HH24:MI:SS',
  1858: '日期格式不正确，请使用 YYYY-MM-DD 或 YYYY-MM-DD HH24:MI:SS',
  1861: '日期格式不正确，请使用 YYYY-MM-DD 或 YYYY-MM-DD HH24:MI:SS',
  2289: '唯一约束冲突：该值已存在',
  2291: '关联记录不存在：请检查外键字段的值',
  2292: '记录被其他数据引用，不能删除',
  30926: '对象为只读，不能执行写入操作',
  12899: '字段内容超过列允许长度',
  12170: '连接数据库超时，请检查网络与端口',
  12514: '服务名（Oracle 模式通常为租户名）不正确',
  12541: '无法连接数据库：地址或端口不可达',
  12545: '无法建立连接：请检查地址、端口与服务名',
  3113: '数据库连接已断开',
  3114: '数据库连接已断开',
  3135: '数据库连接已丢失',
}

/** MySQL 协议侧错误码（Oracle 兼容模式租户经 ODP 走 MySQL 线协议，报错可能是这一类）。 */
const MYSQL_ERRORS: Record<string, string> = {
  ER_ACCESS_DENIED_ERROR: '认证失败：账号、租户或密码不正确（账号需写成 用户名@租户名#集群名）',
  ER_DBACCESS_DENIED_ERROR: '当前账号没有访问该模式的权限',
  ER_TABLEACCESS_DENIED_ERROR: '当前账号没有执行此操作的权限',
  ER_DUP_ENTRY: '主键或唯一约束冲突：该值已存在',
  ER_BAD_NULL_ERROR: '必填字段不能为 NULL',
  ER_NO_DEFAULT_FOR_FIELD: '请填写所有无默认值的必填字段',
  ER_DATA_TOO_LONG: '字段内容超过列允许长度',
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: '字段值与列类型不匹配',
  ER_WARN_DATA_OUT_OF_RANGE: '字段值超出该列允许的范围',
  ER_NO_REFERENCED_ROW_2: '关联记录不存在：请检查外键字段的值',
  ER_ROW_IS_REFERENCED_2: '记录被其他数据引用，不能删除',
  ER_LOCK_WAIT_TIMEOUT: '记录正被其他会话锁定，请稍后重试',
  ER_LOCK_DEADLOCK: '检测到死锁，事务已回滚，请重试',
  ER_QUERY_INTERRUPTED: '数据库操作超时（请求被取消），请刷新核实结果',
  ECONNREFUSED: '目标端口拒绝连接：请检查端口是否正确（ODP 2883 / 直连 observer 2881）',
  ENOTFOUND: '无法解析数据库主机名，请检查连接地址',
  ETIMEDOUT: '连接数据库超时，请检查主机、端口与网络策略',
  PROTOCOL_CONNECTION_LOST: '数据库连接已断开',
  ECONNRESET: '数据库连接已重置',
}

/** 连接中断类错误：写入动作的结果无法确认，必须让用户先核实再重试。 */
const CONNECTION_LOST = new Set([1013, 3113, 3114, 3135, 12170, 12541, 12545])
const CONNECTION_LOST_CODES = new Set(['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'])

export interface FailureResponse { status: number; body: { error: string; uncertain: boolean; code?: string; details?: unknown } }

/**
 * 把驱动/校验异常翻译成给用户看的响应。
 * 绝不回显密码、SQL 原文或行数据：只按错误号/错误码给出原因。
 */
export function describeFailure(error: unknown, action: string): FailureResponse {
  const failure = error as { errorNum?: unknown; code?: unknown; message?: unknown; sqlMessage?: unknown }
  const errorNum = typeof failure.errorNum === 'number' ? failure.errorNum : undefined
  const rawCode = String(failure.code ?? '')
  // Oracle 兼容模式租户的报错文本里带 ORA-xxxxx（经 MySQL 协议原样回传），优先按它翻译。
  const oraMatch = /ORA-(\d{5})/.exec(`${String(failure.message ?? '')} ${String(failure.sqlMessage ?? '')}`)
  const oraNum = errorNum ?? (oraMatch ? Number(oraMatch[1]) : undefined)
  const code = error instanceof OceanBaseError && error.code
    ? error.code
    : oraNum !== undefined ? `ORA-${String(oraNum).padStart(5, '0')}` : rawCode
  const writes = ['insert', 'update', 'delete'].includes(action)
  // 模块自己判断过的错误（例如连接阶段失败）以其结论为准，不再叠加启发式判断。
  const uncertain = error instanceof OceanBaseError
    ? error.uncertain
    : writes && ((oraNum !== undefined && CONNECTION_LOST.has(oraNum)) || CONNECTION_LOST_CODES.has(rawCode))
  const tooLarge = failure.message === 'request body too large'
  const error$ = error instanceof OceanBaseError
    ? error.message
    : error instanceof SyntaxError
      ? '请求 JSON 格式不正确'
      : tooLarge
        ? '请求内容超过 1 MB，请减少字段内容后重试'
        : (oraNum !== undefined ? ORACLE_ERRORS[oraNum] : undefined)
          ?? MYSQL_ERRORS[rawCode]
          ?? '数据库操作失败，请检查字段类型、连接配置和账号权限'
  return {
    status: error instanceof OceanBaseError ? error.status : tooLarge ? 413 : uncertain ? 503 : 400,
    body: {
      error: uncertain ? '连接中断或超时，写入结果尚未确认。请刷新核实记录，勿重复提交。' : error$,
      uncertain,
      ...(code ? { code } : {}),
      ...(error instanceof OceanBaseError && error.details !== undefined ? { details: error.details } : {}),
    },
  }
}

export function mountOceanBase(host: RouteHost, prefix: string): (() => void)[] {
  return ['connect', 'verify', 'profiles', 'ddl-environments', 'ddl-test', 'ddl-compare', 'tables', 'rows', 'insert', 'update', 'delete'].map(action => host.webServer.register({
    kind: 'exact', path: `${prefix}/api/oceanbase/${action}`,
    handler: async (req, res) => {
      if (req.method !== 'POST') { sendJson(res, 405, { error: '请使用 POST 请求' }); return }
      let originOK = false
      try {
        const origin = new URL(req.headers.origin || '')
        originOK = ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host
      } catch { /* Invalid or missing origin. */ }
      if (!originOK || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
        sendJson(res, 403, { error: '仅允许从本应用发起 JSON 请求' }); return
      }
      try {
        const body = object(await readJsonBody(req))
        // 连接档案只读写本地档案文件；DDL 比较自己按配置文件连两套库
        const result = action === 'profiles'
          ? handleProfileAction(body)
          : action === 'ddl-environments'
            ? environmentsForDisplay()
            : action === 'ddl-test'
              ? await testEnvironments()
              : action === 'ddl-compare'
                ? await runComparison(body)
                : await executeOceanBase(action, body)
        sendJson(res, 200, { ok: true, ...object(result) })
      } catch (error) {
        const { status, body } = describeFailure(error, action)
        sendJson(res, status, body)
      }
    },
  }))
}
