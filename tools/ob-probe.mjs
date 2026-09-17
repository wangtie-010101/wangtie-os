#!/usr/bin/env node
/**
 * wangtie-os 诊断工具：抓一次 Oracle 协议握手（支持一次性试多种连接写法）。
 *
 * 背景：OceanBase Oracle 模式**没有官方 Node.js 驱动**（官方只提供 Java 的 OceanBase
 * Connector/J、Python、C/C++），Node 这边只能用 Oracle 协议的驱动（node-oracledb）。
 * 因此「连不通」时要先确认：是连接写法（服务名/入口）不对，还是驱动与服务端协议不兼容。
 *
 * 用法（在**能访问数据库**的那台机器上跑，也就是跑 wangtie-os 服务的那台）：
 *   # 推荐：一次性把常见写法全试一遍，直接看哪种能握手成功
 *   node tools/ob-probe.mjs --variants --host 10.0.0.10 --port 2883 \
 *        --user OB_USER --tenant obtenant_sit --cluster OB_CLUSTER --password '***'
 *
 *   # 只试指定写法（想看字节级细节时用）
 *   node tools/ob-probe.mjs --host 10.0.0.10 --port 2883 --service OB_USER ...
 *
 * 可选：
 *   --variants         依次试「服务名=租户名 / 用户名 / 大写 / SYS / SID 写法 / 不带服务名 / 2881」
 *   --service <名>     指定服务名（也可直接写完整描述符 (DESCRIPTION=...)）
 *   --lib <目录>       传 Oracle Instant Client 目录则用厚模式(OCI)，对兼容性最有参考价值
 *   --timeout <毫秒>   单个写法等待时间，默认 6000（variants 模式建议 4000~6000）
 *   --direct           不走本地代理（代理有干扰时用）
 *   --all              输出完整十六进制转储
 *
 * 只做只读握手 + 一条 SELECT USER FROM DUAL，不写任何数据；密码不会被打印。
 */

import net from 'node:net'
import process from 'node:process'
import { connectHints, decodeTnsPackets, hexDump, readableStrings } from './tns-decode.mjs'

const argv = process.argv.slice(2)
const arg = (name, fallback = '') => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback
}
const flag = name => argv.includes(`--${name}`)

const host = arg('host')
const port = Number(arg('port', '2883'))
const user = arg('user')
const password = arg('password')
const cluster = arg('cluster')
const tenant = arg('tenant') || (/@([^@#]+)/.exec(user)?.[1] ?? '')
const service = arg('service')
const libDir = arg('lib')
const timeoutMs = Number(arg('timeout', flag('variants') ? '6000' : '8000'))
const account = `${user}@${tenant}${cluster ? '#' + cluster : ''}`

if (!host || !user || !tenant) {
  console.error("缺少参数。示例：node tools/ob-probe.mjs --variants --host 10.0.0.10 --port 2883 --user OB_USER --tenant obtenant_sit --cluster OB_CLUSTER --password '***'")
  process.exit(2)
}

/** 本地代理：把驱动的流量原样转给真实地址，同时把两个方向的字节记录下来。 */
async function startProxy(targetHost, targetPort) {
  const outbound = []
  const inbound = []
  const sockets = new Set()
  const server = net.createServer(client => {
    const upstream = net.connect({ host: targetHost, port: targetPort })
    sockets.add(client); sockets.add(upstream)
    client.on('close', () => sockets.delete(client))
    upstream.on('close', () => sockets.delete(upstream))
    client.on('data', chunk => { outbound.push(Buffer.from(chunk)) })
    upstream.on('data', chunk => { inbound.push(Buffer.from(chunk)) })
    client.on('error', () => upstream.destroy())
    upstream.on('error', () => client.destroy())
    client.pipe(upstream)
    upstream.pipe(client)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    port: server.address().port,
    outbound,
    inbound,
    // 先强断所有连接再 close，否则 close 会一直等连接自然结束（客户端可能还挂着）。
    close: () => new Promise(resolve => {
      for (const socket of sockets) socket.destroy()
      sockets.clear()
      server.close(() => resolve())
    }),
  }
}

function report(label, chunks) {
  const buffer = Buffer.concat(chunks)
  if (!buffer.length) {
    console.log(`\n【${label}】0 字节（${timeoutMs} ms 内没有任何响应）`)
    return []
  }
  const { packets, rest } = decodeTnsPackets(buffer)
  console.log(`\n【${label}】共 ${buffer.length} 字节，解析出 ${packets.length} 个 TNS 包`)
  for (const packet of packets) {
    console.log(`  - ${packet.name}(${packet.type})  长度 ${packet.length}`)
    for (const [key, value] of Object.entries(connectHints(packet.payload))) console.log(`      ${key}: ${value}`)
    if (packet.type === 1) {
      const strings = readableStrings(packet.payload).slice(0, 8)
      if (strings.length) console.log(`      可读串: ${strings.join(' | ').slice(0, 300)}`)
    }
  }
  if (rest.length) console.log(`  （另有 ${rest.length} 字节不完整数据）`)
  console.log(hexDump(buffer, flag('all') ? buffer.length : 256))
  return packets
}

/** 试 MySQL 协议（OceanBase Connector/J 走的就是这条路：它是 MariaDB Connector/J 的分支）。 */
async function attemptMysql({ label }) {
  const started = Date.now()
  let connection = null
  const summary = { label, connectString: `${host}:${port} (MySQL 协议)`, ok: false, ms: 0, error: '', sent: 'MySQL 握手', received: '', serviceSent: '', proxy: null }
  try {
    const mysql = (await import('mysql2/promise')).default
    connection = await mysql.createConnection({
      host, port, user: account, password, connectTimeout: timeoutMs,
      supportBigNumbers: true, bigNumberStrings: true, dateStrings: true, namedPlaceholders: true, charset: 'utf8mb4',
    })
    const [rows] = await connection.query('SELECT USER AS current_user FROM DUAL')
    summary.ok = true
    summary.received = 'MySQL 握手 + DUAL 查询'
    summary.error = `成功，返回 ${JSON.stringify(rows?.[0] ?? null)}`
  } catch (failure) {
    summary.error = `${failure.code ? failure.code + ' ' : ''}${String(failure.message).split('\n')[0]}`
  } finally {
    if (connection) await connection.end().catch(() => connection.destroy())
    summary.ms = Date.now() - started
  }
  return summary
}

/** 试一种连接写法：返回结果摘要 + 抓到的包。 */
async function attempt(oracledb, { label, connectString, targetPort, capture }) {
  // 完整描述符里已经写死了 HOST/PORT，代理没法改写，只能直连（此时不抓字节）。
  const describable = !/^\(/.test(connectString) && !flag('direct')
  const proxy = describable ? await startProxy(host, targetPort) : null
  const suffix = connectString.includes('/') ? connectString.slice(connectString.indexOf('/')) : '/'
  const viaProxy = proxy ? `127.0.0.1:${proxy.port}${suffix}` : connectString
  const started = Date.now()
  let error = null
  let ok = false
  try {
    const connection = await Promise.race([
      oracledb.getConnection({ user: account, password, connectString: viaProxy }),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error(`客户端自身等待超时（${timeoutMs} ms）`)), timeoutMs)),
    ])
    const result = await connection.execute('SELECT USER AS current_user FROM DUAL')
    ok = true
    error = `成功，返回 ${JSON.stringify(result.rows?.[0] ?? null)}`
    await connection.close()
  } catch (failure) {
    error = `${failure.code ? failure.code + ' ' : ''}${String(failure.message).split('\n')[0]}`
  } finally {
    if (proxy) await proxy.close()
  }
  const outboundPackets = proxy ? decodeTnsPackets(Buffer.concat(proxy.outbound)).packets : []
  const inboundPackets = proxy ? decodeTnsPackets(Buffer.concat(proxy.inbound)).packets : []
  const summary = {
    label,
    connectString,
    ok,
    ms: Date.now() - started,
    error,
    sent: outboundPackets.map(packet => packet.name).join(','),
    received: proxy ? (inboundPackets.map(packet => packet.name).join(',') || '（无响应）') : '（描述符写法不抓包）',
    serviceSent: outboundPackets.filter(packet => packet.type === 1)
      .map(packet => connectHints(packet.payload).service).filter(Boolean).join(','),
    proxy,
  }
  if (capture) summary.detail = () => { report('客户端 → 服务器', proxy.outbound); report('服务器 → 客户端', proxy.inbound) }
  return summary
}

/** 常见连接写法：服务名/用户名/大写/SYS、SID 写法、不带服务名、以及换到 2881。 */
function variantsFor() {
  const sid = (name) => `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))(CONNECT_DATA=(SID=${name})))`
  const list = [
    { label: `服务名=租户名 (${tenant})`, connectString: `${host}:${port}/${tenant}`, targetPort: port },
    { label: `服务名=用户名 (${user}) ← 你那个 JDBC URL 的写法`, connectString: `${host}:${port}/${user}`, targetPort: port },
    { label: `服务名=租户名大写 (${tenant.toUpperCase()})`, connectString: `${host}:${port}/${tenant.toUpperCase()}`, targetPort: port },
    { label: '服务名=SYS', connectString: `${host}:${port}/SYS`, targetPort: port },
    { label: `SID=租户名 (${tenant})`, connectString: sid(tenant), targetPort: port },
    { label: `SID=用户名 (${user})`, connectString: sid(user), targetPort: port },
    { label: '不带服务名 (host:port)', connectString: `${host}:${port}`, targetPort: port },
  ]
  if (port !== 2881) list.push({ label: `直连 observer 2881，服务名=租户名`, connectString: `${host}:2881/${tenant}`, targetPort: 2881 })
  return list
}

async function main() {
  const oracledb = (await import('oracledb')).default
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER, oracledb.CLOB]
  if (libDir) {
    try {
      oracledb.initOracleClient({ libDir })
    } catch (error) {
      console.error('initOracleClient 失败（厚模式不可用）:', error.message)
      process.exit(2)
    }
  }

  console.log('=== wangtie-os Oracle 协议握手探针 ===')
  console.log(`目标主机  : ${host}`)
  console.log(`用户名    : ${account}`)
  console.log(`驱动模式  : ${libDir ? `厚模式(OCI, libDir=${libDir})` : 'thin 模式(纯 JS)'}`)
  console.log('说明      : OceanBase Oracle 模式没有官方 Node 驱动，Node 侧只能用 Oracle 协议驱动；')
  console.log('            本工具用来确认是「连接写法不对」还是「驱动与服务端协议不兼容」。')

  if (flag('variants')) {
    const list = variantsFor()
    console.log(`\n开始逐个尝试 ${list.length + 1} 种写法（每种最多等 ${timeoutMs} ms）……\n`)
    const results = []
    for (const item of list) {
      process.stdout.write(`  · ${item.label} … `)
      const result = await attempt(oracledb, { ...item, connectString: item.connectString, capture: false })
      results.push(result)
      console.log(result.ok ? '✅ 成功' : `❌ ${result.ms} ms`)
    }
    // 最后再试 MySQL 协议：OceanBase 的 Oracle 模式租户实际上是通过 MySQL 线协议访问的
    // （OceanBase Connector/J 就是 MariaDB Connector/J 分支），Oracle 只是 SQL 方言层。
    const mysqlLabel = 'MySQL 协议（OceanBase Connector/J 走的就是这条）'
    process.stdout.write(`  · ${mysqlLabel} … `)
    const mysqlResult = await attemptMysql({ label: mysqlLabel })
    results.push(mysqlResult)
    console.log(mysqlResult.ok ? '✅ 成功' : `❌ ${mysqlResult.ms} ms`)

    console.log('\n=== 结果汇总 ===')
    for (const result of results) {
      console.log(`${result.ok ? '✅' : '❌'} ${result.label}`)
      console.log(`     连接串: ${result.connectString}`)
      console.log(`     发出包: ${result.sent || '（无）'} | 服务名: ${result.serviceSent || '（无）'} | 服务端: ${result.received || '（无响应）'}`)
      console.log(`     结果  : ${result.ok ? result.error : result.error.slice(0, 200)}`)
    }
    const winner = results.find(result => result.ok)
    const oracleAnswered = results.some(result => result.received && result.received !== '（无响应）' && result.received !== '（描述符写法不抓包）')
    console.log('\n=== 结论 ===')
    if (winner && winner.sent === 'MySQL 握手') {
      console.log('✅ 只有 **MySQL 协议** 能连上，Oracle 协议（TNS）在你这个入口上没有任何响应。')
      console.log('   → 这说明该租户是「Oracle 兼容模式」但走的是 **MySQL 线协议**（OceanBase Connector/J 就是这样连的），')
      console.log('     Oracle 只是 SQL 方言层。应用侧应当改用 MySQL 协议驱动（mysql2），SQL 仍写 Oracle 方言。')
      console.log('   → 本包已按这个方式实现（模块内用 mysql2 连、SQL 用 Oracle 方言），直接启动预览即可连接。')
    } else if (winner) {
      console.log(`✅ 可用写法：${winner.connectString}`)
      console.log(`   → 在页面「高级设置 → 服务名」里填：${winner.connectString.slice(winner.connectString.indexOf('/') + 1)}`)
      console.log('   → 或者直接把这个连接串整段填进服务名输入框（支持完整描述符）。')
    } else if (!oracleAnswered) {
      console.log('❌ Oracle 协议（TNS）在这个入口上：TCP 能连、但服务端对 8 种写法的 CONNECT 都**没有任何响应**，')
      console.log('   而 MySQL 协议也没连上 → 请确认账号/密码，以及是否允许从这台机器访问该 ODP。')
      console.log('   参考：OceanBase 的 Oracle 兼容租户通常用 MySQL 线协议访问（OBJDBC 即如此）。')
    } else if (results.some(result => (result.received || '').includes('ACCEPT'))) {
      console.log('至少有一种写法服务端回了 ACCEPT，但之后仍失败 → 属于**驱动与服务端的协议兼容问题**：')
      console.log('  1) 用 --lib <Oracle Instant Client 目录> 再跑一遍（OCI 是 OceanBase 官方支持的 Oracle 客户端实现）；')
      console.log('  2) 若 OCI 也失败，改用 MySQL 协议驱动（mysql2）连同一个租户。')
    } else {
      console.log('服务端有回应但不是 ACCEPT，请看上面的包类型；把完整输出贴给开发。')
    }
    process.exit(winner ? 0 : 1)
  }

  // 单写法模式：输出字节级细节
  const connectString = service || `${host}:${port}`
  const resolved = /^\(/.test(connectString) || connectString.includes(':') ? connectString : `${host}:${port}/${connectString}`
  console.log(`\n握手地址  : ${resolved}`)
  const result = await attempt(oracledb, { label: 'single', connectString: resolved, targetPort: port, capture: true })
  console.log(`\n${result.ok ? '✅ 握手成功' : '❌ 握手失败'}（${result.ms} ms）: ${result.error}`)
  result.detail?.()

  console.log('\n=== 结论 ===')
  if (result.ok) {
    console.log('这条链路可以完成 Oracle 协议握手，驱动与服务端兼容；问题不在协议层。')
  } else if (result.received === '（无响应）') {
    console.log('TCP 连上了，但服务端在超时时间内**没有回任何 TNS 包**。可能：')
    console.log('  1) 该端口不是 Oracle 协议入口（例如 ODP 上没开 Oracle 协议，或中间有负载均衡）；')
    console.log('  2) 服务名/租户不被 ODP 识别，包被丢弃；加 --variants 把常见写法一次试完。')
  } else if (result.received.includes('REFUSE')) {
    console.log('服务端回了 REFUSE（拒绝）：服务名、租户或账号不被识别，看上面报文里的 ORA-/TNS- 文本。')
  } else if (result.received.includes('ACCEPT')) {
    console.log('服务端回了 ACCEPT，说明路由是对的，失败点在其后的 TTC/数据协商：')
    console.log('  → 属于驱动兼容性问题；用 --lib <Instant Client 目录> 跑厚模式(OCI)对照，OCI 是官方支持的实现。')
  } else {
    console.log('服务端有响应但没走到 ACCEPT，请看上面的包类型与文本。')
  }
  process.exit(result.ok ? 0 : 1)
}

main().catch(error => {
  console.error('探针本身出错:', error)
  process.exit(2)
})

export { startProxy }
