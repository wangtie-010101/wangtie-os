/**
 * 握手探针的单元测试：TNS 报文解析 + 用假服务器跑一遍完整探针流程。
 * 不依赖任何真实数据库。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { connectHints, decodeTnsPackets, hexDump, readableStrings } from '../tools/tns-decode.mjs'

/** 按 TNS 头格式拼一个包（长度 2B + 校验和 2B + 类型 1B + 保留 1B + 头校验 2B）。 */
function tnsPacket(type, payload = '') {
  const body = Buffer.from(payload, 'latin1')
  const packet = Buffer.alloc(8 + body.length)
  packet.writeUInt16BE(packet.length, 0)
  packet.writeUInt16BE(0, 2)
  packet[4] = type
  packet[5] = 0
  packet.writeUInt16BE(0, 6)
  body.copy(packet, 8)
  return packet
}

test('TNS packets are split on real packet boundaries, including partial tails', () => {
  const accept = tnsPacket(2, '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=10.0.0.10)(PORT=2883))(CONNECT_DATA=(SERVICE_NAME=obtenant_sit)))')
  const refused = tnsPacket(4, 'ORA-12514: TNS:listener does not currently know of service requested')
  const stream = Buffer.concat([accept, refused])

  const parsed = decodeTnsPackets(stream)
  assert.equal(parsed.packets.length, 2)
  assert.deepEqual(parsed.packets.map(packet => packet.name), ['ACCEPT', 'REFUSE'])
  assert.equal(parsed.rest.length, 0)
  assert.equal(parsed.packets[1].length, refused.length)

  // 半包必须留在 rest 里，不能当成完整包解析
  const half = decodeTnsPackets(Buffer.concat([accept, refused.subarray(0, 5)]))
  assert.equal(half.packets.length, 1)
  assert.equal(half.rest.length, 5)

  // 长度字段非法时直接停下，避免把垃圾数据当包
  const garbage = decodeTnsPackets(Buffer.from([0x00, 0x03, 0, 0, 6, 0, 0, 0]))
  assert.equal(garbage.packets.length, 0)
})

test('connect hints surface the service name, address and any Oracle error text', () => {
  const payload = Buffer.from('(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=10.0.0.10)(PORT=2883))(CONNECT_DATA=(SERVICE_NAME=obtenant_sit)))', 'latin1')
  assert.deepEqual(connectHints(payload), {
    service: 'obtenant_sit',
    host: '10.0.0.10',
    port: '2883',
    description: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=10.0.0.10)(PORT=2883))(CONNECT_DATA=(SERVICE_NAME=obtenant_sit)))',
  })
  const failure = connectHints(Buffer.from('ORA-12514: TNS:listener does not currently know of service requested', 'latin1'))
  assert.match(failure.error, /ORA-12514/)
  assert.equal(connectHints(Buffer.from([0x00, 0x01, 0x02])).service, undefined)
  assert.deepEqual(readableStrings(Buffer.from('ab\0cd\0', 'latin1'), 2), ['ab', 'cd'])
  assert.match(hexDump(Buffer.from('TNS', 'latin1')), /544e53/i)
})

test('probe tool reports the server handshake instead of a bare timeout', async t => {
  // 假 ODP：收到客户端 CONNECT 后回一个 ACCEPT（探针经本地代理抓这两个方向的字节）
  const server = createServer(socket => {
    socket.once('data', () => {
      socket.write(tnsPacket(2, '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=127.0.0.1)(PORT=0))(CONNECT_DATA=(SERVICE_NAME=obtenant_sit)))'))
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections?.(); server.close() })

  const probe = fileURLToPath(new URL('../tools/ob-probe.mjs', import.meta.url))
  const root = fileURLToPath(new URL('..', import.meta.url))
  // 必须用异步 spawn：spawnSync 会阻塞本进程事件循环，同一进程里的假服务器就无法应答
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, [
      probe, '--host', '127.0.0.1', '--port', String(server.address().port), '--service', 'obtenant_sit',
      '--user', 'OB_USER', '--tenant', 'obtenant_sit', '--cluster', 'OB_CLUSTER', '--password', 'probe-only', '--timeout', '4000',
    ], { cwd: root })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', status => resolve({ stdout, stderr, status }))
  })

  const output = `${result.stdout}${result.stderr}`
  assert.match(output, /客户端 → 服务器/, 'must dump what the client sent')
  assert.match(output, /CONNECT\(1\)/, 'the client CONNECT packet is classified')
  assert.match(output, /服务器 → 客户端/, 'must dump what the server replied')
  assert.match(output, /ACCEPT\(2\)/, 'a server ACCEPT is recognised')
  assert.match(output, /service: obtenant_sit|SERVICE_NAME=obtenant_sit/, 'service name is surfaced for verification')
  assert.match(output, /服务端回了 ACCEPT/, 'the conclusion explains the ACCEPT branch')
  assert.doesNotMatch(output, /probe-only/, 'the password must never be printed')
})

test('--variants mode tries several connect forms and ends with an actionable conclusion', async t => {
  // 假 ODP：任何连接都回 ACCEPT（真实环境里可能只对某种写法回 ACCEPT）
  const server = createServer(socket => {
    socket.on('data', () => socket.write(tnsPacket(2, '(DESCRIPTION=(CONNECT_DATA=(SERVICE_NAME=obtenant_sit)))')))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections?.(); server.close() })

  const probe = fileURLToPath(new URL('../tools/ob-probe.mjs', import.meta.url))
  const root = fileURLToPath(new URL('..', import.meta.url))
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, [
      probe, '--variants', '--host', '127.0.0.1', '--port', String(server.address().port),
      '--user', 'OB_USER', '--tenant', 'obtenant_sit', '--cluster', 'OB_CLUSTER', '--password', 'probe-only', '--timeout', '800',
    ], { cwd: root })
    let stdout = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stdout += chunk })
    child.on('close', () => resolve(stdout))
  })

  assert.match(result, /开始逐个尝试 \d+ 种写法/)
  assert.match(result, /服务名=租户名/, 'tries the tenant-as-service-name form')
  assert.match(result, /服务名=用户名/, 'tries the user-as-service-name form (as in the working JDBC URL)')
  assert.match(result, /SID=租户名/, 'tries the SID form')
  assert.match(result, /=== 结果汇总 ===/)
  assert.match(result, /=== 结论 ===/)
  assert.doesNotMatch(result, /probe-only/)
})
