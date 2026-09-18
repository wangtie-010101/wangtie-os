/**
 * 王铁 OS — 最小 ZIP 读取器（浏览器端，无第三方依赖）。
 *
 * 用途：`.docx`（Word）、`.ofd`（OFD 版式文档）本质都是 ZIP；
 * 「常用开发工具」里的解压工具也用同一套。
 *
 * 读取顺序：
 *   1) 优先按**中央目录**读（正常 ZIP 都带它）——压缩大小一定写在中央目录里，
 *      因此**带数据描述符的包（本地头里大小为 0）也能正确读出**；
 *   2) 找不到中央目录时退回逐个扫本地文件头（兼容手工拼出来的残缺包）。
 *
 * 每个条目返回 `{ name, method, compSize, size, data }`：
 *   - `data` 是**压缩后的原始字节**（和压缩工具页显示的体积一致），文本要走 `entryText()`；
 *   - `method`：0 = 存储（不压缩），8 = DEFLATE。
 */

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
/** 中央目录尾记录的扫描范围：22 字节固定尾 + 最多 65535 字节注释。 */
const EOCD_SEARCH = 22 + 0xffff
/** readEntry 能处理的最大解压体积（防御性上限，避免解出超大内容把页面卡死）。 */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024

export function zipEntries(bytes) {
  const fromCentral = entriesFromCentralDirectory(bytes)
  return fromCentral.length ? fromCentral : entriesFromLocalHeaders(bytes)
}

/** 中央目录路径：先定位 EOCD，再逐条读，数据段按本地头里的名称/扩展字段长度定位。 */
function entriesFromCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEocd(view, bytes.length)
  if (eocd < 0) return []
  const count = view.getUint16(eocd + 10, true)
  const offset = view.getUint32(eocd + 16, true)
  // ZIP64 用 0xFFFFFFFF 占位，本模块不做 ZIP64：交给本地头扫描兜底。
  if (count === 0xffff || offset === 0xffffffff) return []
  const entries = []
  let at = offset
  for (let i = 0; i < count && at + 46 <= bytes.length; i += 1) {
    if (view.getUint32(at, true) !== SIG_CENTRAL) break
    const method = view.getUint16(at + 10, true)
    const compSize = view.getUint32(at + 20, true)
    const size = view.getUint32(at + 24, true)
    const nameLen = view.getUint16(at + 28, true)
    const extraLen = view.getUint16(at + 30, true)
    const commentLen = view.getUint16(at + 32, true)
    const localAt = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen))
    const data = dataSlice(bytes, view, localAt, compSize)
    if (data !== null) entries.push({ name, method, compSize, size, data })
    at += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** 本地文件头路径：逐个往后扫，遇到非本地头签名（例如中央目录）即结束。 */
function entriesFromLocalHeaders(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = []
  let at = 0
  while (at + 30 <= bytes.length && view.getUint32(at, true) === SIG_LOCAL) {
    const method = view.getUint16(at + 8, true)
    const compSize = view.getUint32(at + 18, true)
    const size = view.getUint32(at + 22, true)
    const nameLen = view.getUint16(at + 26, true)
    const extraLen = view.getUint16(at + 28, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLen))
    const start = at + 30 + nameLen + extraLen
    const data = bytes.subarray(start, Math.min(start + compSize, bytes.length))
    entries.push({ name, method, compSize, size, data })
    at = start + compSize
  }
  return entries
}

function findEocd(view, length) {
  const floor = Math.max(0, length - EOCD_SEARCH)
  for (let at = length - 22; at >= floor; at -= 1) {
    if (view.getUint32(at, true) === SIG_EOCD) return at
  }
  return -1
}

/** 按本地头定位数据段；本地头损坏或越界时返回 null（该条目跳过）。 */
function dataSlice(bytes, view, localAt, compSize) {
  if (localAt + 30 > bytes.length || view.getUint32(localAt, true) !== SIG_LOCAL) return null
  const nameLen = view.getUint16(localAt + 26, true)
  const extraLen = view.getUint16(localAt + 28, true)
  const start = localAt + 30 + nameLen + extraLen
  if (start + compSize > bytes.length) return null
  return bytes.subarray(start, start + compSize)
}

export async function inflateRawDeflate(compressed) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 ZIP 解压（请使用新版 Chrome / Safari）')
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/** 取出一个条目的原始内容（自动处理存储/DEFLATE）。 */
export async function readEntry(entry) {
  if (!entry) throw new Error('压缩包内没有这个条目')
  if (entry.size > MAX_ENTRY_BYTES) throw new Error(`条目过大（超过 ${Math.round(MAX_ENTRY_BYTES / 1048576)} MB），已跳过`)
  if (entry.method === 0) return entry.data
  if (entry.method === 8) return inflateRawDeflate(entry.data)
  throw new Error(`不支持的压缩方式（method=${entry.method}）`)
}

/** 取出一个条目并按 UTF-8 解码成文本（docx / ofd 的 XML 都走这里）。 */
export async function entryText(entry) {
  return new TextDecoder().decode(await readEntry(entry))
}
