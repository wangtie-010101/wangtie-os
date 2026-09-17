/**
 * TNS（Oracle 协议）报文头解析。
 *
 * Oracle 客户端与数据库之间的每一次交互都是一串「TNS 包」，每个包 8 字节头 + 负载：
 *   [0..1] 包总长度（大端）
 *   [2..3] 校验和
 *   [4]    包类型（1=CONNECT 2=ACCEPT 3=ACK 4=REFUSE 5=REDIRECT 6=DATA 9=RESEND 11=MARKER 12=ATTENTION 14=CONTROL）
 *   [5]    保留位
 *   [6..7] 头校验和（Oracle 11g 起）
 * 排查握手问题时，看「谁发了什么类型的包、服务端有没有回 ACCEPT」就能定位到具体环节。
 */

export const TNS_TYPES = {
  1: 'CONNECT',
  2: 'ACCEPT',
  3: 'ACK',
  4: 'REFUSE',
  5: 'REDIRECT',
  6: 'DATA',
  7: 'NULL',
  8: 'ABORT',
  9: 'RESEND',
  11: 'MARKER',
  12: 'ATTENTION',
  13: 'CONTROL',
  14: 'CONTROL',
  15: 'RESEND',
}

/** 把一段字节流切成完整的 TNS 包；尾部不完整的字节放在 rest 里等下一批。 */
export function decodeTnsPackets(buffer) {
  const packets = []
  let offset = 0
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt16BE(offset)
    if (length < 8) break // 长度非法，别再往前走了
    if (offset + length > buffer.length) break // 半包，等后续数据
    const type = buffer[offset + 4]
    packets.push({
      type,
      name: TNS_TYPES[type] ?? `TYPE_${type}`,
      length,
      payload: buffer.subarray(offset + 8, offset + length),
    })
    offset += length
  }
  return { packets, rest: buffer.subarray(offset) }
}

/** 从包负载里抽出可读字符串（连接描述符、服务名、错误文本都在里面）。 */
export function readableStrings(payload, minLength = 4) {
  const text = Buffer.from(payload).toString('latin1')
  return text.match(new RegExp(`[\\x20-\\x7e]{${minLength},}`, 'g')) ?? []
}

/** 从 CONNECT 包的可读串里挑出最像服务名 / 连接描述符的片段，便于一眼确认。 */
export function connectHints(payload) {
  const strings = readableStrings(payload)
  const joined = strings.join(' ')
  const hints = {}
  const service = /SERVICE_NAME\s*=\s*([^)\s]+)/i.exec(joined)
  if (service) hints.service = service[1]
  const host = /HOST\s*=\s*([^)\s]+)/i.exec(joined)
  if (host) hints.host = host[1]
  const port = /PORT\s*=\s*([0-9]+)/i.exec(joined)
  if (port) hints.port = port[1]
  const description = strings.find(item => item.includes('DESCRIPTION') || item.includes('CONNECT_DATA'))
  if (description) hints.description = description.slice(0, 240)
  const error = strings.find(item => /ORA-\d{5}|TNS-\d{5}|DPY-\d{4}|NJS-\d{3}/.test(item))
  if (error) hints.error = error.slice(0, 240)
  return hints
}

/** 十六进制摘要，方便贴到工单/聊天里。 */
export function hexDump(buffer, limit = 128) {
  const data = Buffer.from(buffer).subarray(0, limit)
  const lines = []
  for (let offset = 0; offset < data.length; offset += 16) {
    const chunk = data.subarray(offset, offset + 16)
    lines.push(`${String(offset).padStart(4, '0')}  ${chunk.toString('hex').padEnd(32, ' ')}  ${chunk.toString('latin1').replace(/[^\x20-\x7e]/g, '.')}`)
  }
  if (buffer.length > limit) lines.push(`...（共 ${buffer.length} 字节，只显示前 ${limit} 字节）`)
  return lines.join('\n')
}
