/**
 * 王铁 OS — ZIP / Word(.docx) / OFD(.ofd) 前端解析测试。
 * 全部在内存里拼 ZIP，不依赖真实文件、不接触网络。
 *
 * 生成的包带完整中央目录；其中一条用例故意用「数据描述符」（本地头里大小为 0），
 * 用来验证读取器是走中央目录的——这正是部分 OFD 电子发票的打包方式。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { readEntry, entryText, zipEntries } from '../ui/zip.js'
import { extractDocxText } from '../ui/docx.js'
import { extractOfdMeta, extractOfdText, ofdLinesFromXml } from '../ui/ofd.js'

/** 拼一个结构完整的 ZIP（本地头 + 数据 + 中央目录 + EOCD）。crc 不参与校验，填 0。 */
function buildZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const raw = Buffer.from(entry.content ?? '', 'utf8')
    const method = entry.method === 0 ? 0 : 8
    const data = method === 0 ? raw : deflateRawSync(raw)
    const descriptor = entry.descriptor === true

    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(descriptor ? 0x08 : 0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(0, 14)
    local.writeUInt32LE(descriptor ? 0 : data.length, 18)
    local.writeUInt32LE(descriptor ? 0 : raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    name.copy(local, 30)
    const chunks = [local, data]
    if (descriptor) {
      const dd = Buffer.alloc(16)
      dd.writeUInt32LE(0x08074b50, 0)
      dd.writeUInt32LE(0, 4)
      dd.writeUInt32LE(data.length, 8)
      dd.writeUInt32LE(raw.length, 12)
      chunks.push(dd)
    }

    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(descriptor ? 0x08 : 0, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    name.copy(central, 46)

    locals.push(...chunks)
    centrals.push(central)
    offset += chunks.reduce((total, chunk) => total + chunk.length, 0)
  }
  const directory = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(centrals.length, 8)
  eocd.writeUInt16LE(centrals.length, 10)
  eocd.writeUInt32LE(directory.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...locals, directory, eocd]))
}

/* --------------------------------- ZIP ---------------------------------- */

test('zip: reads stored and deflated entries with their names and content', async () => {
  const bytes = buildZip([
    { name: 'plain.txt', content: '存储条目', method: 0 },
    { name: 'Doc_0/Pages/Page_0/Content.xml', content: '<x>压缩条目</x>' },
  ])
  const entries = zipEntries(bytes)
  assert.deepEqual(entries.map((entry) => entry.name), ['plain.txt', 'Doc_0/Pages/Page_0/Content.xml'])
  assert.equal(entries[0].method, 0)
  assert.equal(entries[1].method, 8)
  assert.equal(await entryText(entries[0]), '存储条目')
  assert.equal(await entryText(entries[1]), '<x>压缩条目</x>')
})

test('zip: entries written with a data descriptor still read (central directory wins)', async () => {
  // 本地头里大小为 0、真实大小写在数据描述符里——顺序扫本地头会读成空条目
  const bytes = buildZip([{ name: 'word/document.xml', content: '<w:p><w:r><w:t>描述符</w:t></w:r></w:p>', descriptor: true }])
  const [entry] = zipEntries(bytes)
  assert.equal(entry.name, 'word/document.xml')
  assert.equal(await entryText(entry), '<w:p><w:r><w:t>描述符</w:t></w:r></w:p>')
})

test('zip: unknown compression method is reported instead of garbage', async () => {
  const bytes = buildZip([{ name: 'a.bin', content: 'x' }])
  const [entry] = zipEntries(bytes)
  await assert.rejects(() => readEntry({ ...entry, method: 12 }), /不支持的压缩方式/)
})

/* -------------------------------- Word ---------------------------------- */

test('docx: paragraphs, tabs, line breaks and entities become text lines', async () => {
  const xml = '<w:document><w:body>'
    + '<w:p><w:r><w:t>票据池业务要点</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>贴现利率</w:t><w:tab/><w:t>3.5%</w:t><w:br/><w:t>承兑人</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>甲&amp;乙</w:t></w:r></w:p>'
    + '</w:body></w:document>'
  const lines = await extractDocxText(buildZip([{ name: 'word/document.xml', content: xml }]))
  assert.deepEqual(lines, ['票据池业务要点', '贴现利率\t3.5%', '承兑人', '甲&乙'])
})

test('docx: a plain zip without word/document.xml is rejected with a clear message', async () => {
  await assert.rejects(() => extractDocxText(buildZip([{ name: 'a.txt', content: 'hi' }])), /word\/document\.xml/)
})

/* --------------------------------- OFD ---------------------------------- */

/** 拼一页 OFD 页面 XML；items 为 [x, y, text]。 */
const ofdPage = (items) => '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016"><ofd:Content><ofd:Layer>\n'
  + items.map(([x, y, text]) => `<ofd:TextObject ID="t" Boundary="0 0 50 5"><ofd:TextCode X="${x}" Y="${y}">${text}</ofd:TextCode></ofd:TextObject>`).join('\n')
  + '\n</ofd:Layer></ofd:Content></ofd:Page>'

test('ofd: text blocks are restored into lines by their X/Y coordinates', async () => {
  // 故意打乱顺序：同一 Y 的两块要合成一行，且按 X 从左到右
  const page = ofdPage([
    [72, 20, '25317000000012345678'],
    [10, 30, '开票日期：2026年09月17日'],
    [10, 20, '发票号码：'],
    [10, 40, '价税合计（大写）&amp;小写 ¥1,234.56'],
  ])
  const lines = await extractOfdText(buildZip([{ name: 'Doc_0/Pages/Page_0/Content.xml', content: page }]))
  assert.deepEqual(lines, [
    '发票号码：25317000000012345678',
    '开票日期：2026年09月17日',
    '价税合计（大写）&小写 ¥1,234.56',
  ])
})

test('ofd: TextCode offsets are relative to their TextObject boundary', async () => {
  // 真实文件（如农发银通知）里每个 TextObject 一段 Boundary，TextCode 的 X/Y 只是块内偏移；
  // 不换算成绝对坐标就会把整页压成一行——这条用例锁住这个回归。
  const page = '<?xml version="1.0" encoding="UTF-8"?>\n<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016"><ofd:Content><ofd:Layer>'
    + '<ofd:TextObject ID="t1" Boundary="10 20 100 5"><ofd:TextCode X="0" Y="0">第一行左</ofd:TextCode><ofd:TextCode X="40" Y="0">第一行右</ofd:TextCode></ofd:TextObject>'
    + '<ofd:TextObject ID="t2" Boundary="10 30 100 5"><ofd:TextCode X="0" Y="0">第二行</ofd:TextCode></ofd:TextObject>'
    + '</ofd:Layer></ofd:Content></ofd:Page>'
  const lines = await extractOfdText(buildZip([{ name: 'Doc_0/Pages/Page_0/Content.xml', content: page }]))
  assert.deepEqual(lines, ['第一行左第一行右', '第二行'])
})

test('ofd: pages are concatenated in page-number order, not path order', async () => {
  const bytes = buildZip([
    { name: 'Doc_0/Pages/Page_10/Content.xml', content: ofdPage([[10, 10, '第十页']]) },
    { name: 'Doc_0/Pages/Page_2/Content.xml', content: ofdPage([[10, 10, '第二页']]) },
    { name: 'Doc_0/Pages/Page_0/Content.xml', content: ofdPage([[10, 10, '第一页']]) },
    { name: 'Doc_0/Document.xml', content: '<ofd:Document><ofd:CommonData><ofd:Title>电子发票（普通发票）</ofd:Title></ofd:CommonData></ofd:Document>' },
  ])
  assert.deepEqual(await extractOfdText(bytes), ['第一页', '第二页', '第十页'])
  assert.deepEqual(await extractOfdMeta(bytes), { pages: 3, title: '电子发票（普通发票）' })
})

test('ofd: falls back to stripped text when there is no TextCode, and keeps document order when all Y are equal', () => {
  assert.deepEqual(ofdLinesFromXml('<ofd:Page><ofd:Content>甲乙丙</ofd:Content><ofd:Other>丁戊</ofd:Other></ofd:Page>'), ['甲乙丙', '丁戊'])
  const sameY = ofdPage([[10, 5, 'A'], [30, 5, 'B'], [50, 5, 'C']])
  assert.deepEqual(ofdLinesFromXml(sameY), ['A', 'B', 'C'], '同一 Y 无法分行时按文档顺序，不要挤成一行')
})

test('ofd: image-only or non-OFD input is rejected with an actionable message', async () => {
  await assert.rejects(() => extractOfdText(buildZip([{ name: 'readme.txt', content: 'no pages' }])), /未找到页面内容/)
  const imageOnly = buildZip([{ name: 'Doc_0/Pages/Page_0/Content.xml', content: '<ofd:Page><ofd:ImageObject ID="i1"/></ofd:Page>' }])
  await assert.rejects(() => extractOfdText(imageOnly), /未提取到文字/)
})
