/**
 * 王铁 OS — OFD（.ofd，GB/T 33190 版式文档 / 电子发票）正文提取。
 *
 * .ofd 本质是 ZIP + XML：`Doc_0/Pages/Page_N/Content.xml` 里用
 * `<ofd:TextCode X=".." Y="..">文字</ofd:TextCode>` 存放文字块，坐标单位是毫米。
 * 读取顺序：多页按页码排序 → 每页按 Y（行）、X（列）排序还原成文本行，
 * 让「发票号码 / 开票日期 / 金额」这类版式文字读起来仍然是成行的，便于检索与投喂。
 *
 * 兜底：没有 TextCode（或坐标不可用）时退回按文档顺序取文本；再不行就剥标签。
 * 纯图片/扫描版 OFD 提不出文字，会明确报错提示先 OCR。
 */

import { entryText, zipEntries } from './zip.js'

/** 同一行的 Y 容差（毫米）：版式文档里同一行文字块的基线一致，字高通常 3mm 以上。 */
const LINE_TOLERANCE = 1.5

const TEXT_OBJECT = /<(?:[\w-]+:)?TextObject\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?TextObject>/g
const TEXT_CODE = /<(?:[\w-]+:)?TextCode\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?TextCode>/g

/**
 * 一个文字块的绝对坐标。
 *
 * 关键：OFD 里 `TextCode` 的 X/Y 是**相对所属 `TextObject` 的 Boundary 原点**的偏移，
 * 不是页面绝对坐标。只按 TextCode 的 Y 分行，会把整页的文字挤成一行
 * （实测：22 页的通知被压成 51 行）。所以要通过 TextObject 的 Boundary 换算成绝对坐标。
 */
function absoluteItems(objectAttrs, codeAttrs, text) {
  const boundary = /Boundary\s*=\s*"([^"]*)"/.exec(objectAttrs)?.[1]?.trim().split(/\s+/).map(Number) ?? []
  const originX = Number.isFinite(boundary[0]) ? boundary[0] : 0
  const originY = Number.isFinite(boundary[1]) ? boundary[1] : 0
  const x = attr(codeAttrs, 'X')
  const y = attr(codeAttrs, 'Y')
  return {
    x: Number.isFinite(x) ? originX + x : Number.NaN,
    y: Number.isFinite(y) ? originY + y : Number.NaN,
    text,
    order: 0,
  }
}

function attr(attrs, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(attrs)
  return match ? Number(match[1]) : Number.NaN
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** 页面 XML 里没有文字块时的兜底：直接剥掉标签取文本行。 */
function strippedLines(xml) {
  const text = decodeEntities(xml.replace(/<[^>]*>/g, '\n'))
  const lines = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (line && line !== lines[lines.length - 1]) lines.push(line)
  }
  return lines
}

/**
 * 单页 Content.xml → 文本行。
 * @param xml 页面 XML 文本
 * @returns 文本行数组（已按版面顺序还原、去空行）
 */
export function ofdLinesFromXml(xml) {
  const source = String(xml)
  const items = []
  let order = 0
  const push = (codeAttrs, rawText, objectAttrs = '') => {
    const text = decodeEntities(rawText.replace(/<[^>]*>/g, ''))
    if (!text.trim()) return
    const item = absoluteItems(objectAttrs, codeAttrs, text)
    item.order = order++
    items.push(item)
  }

  // 文字块优先按所属 TextObject 解析（拿到 Boundary 原点），并把扫过的片段抠掉，
  // 剩下的 TextCode 视为没有 Boundary（原点 0,0）——保证不漏字。
  let rest = source
  TEXT_OBJECT.lastIndex = 0
  let object
  while ((object = TEXT_OBJECT.exec(source)) !== null) {
    TEXT_CODE.lastIndex = 0
    let code
    while ((code = TEXT_CODE.exec(object[2])) !== null) push(code[1], code[2], object[1])
    rest = rest.replace(object[0], '')
  }
  TEXT_CODE.lastIndex = 0
  let code
  while ((code = TEXT_CODE.exec(rest)) !== null) push(code[1], code[2])

  if (items.length === 0) return strippedLines(xml)

  const positioned = items.filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
  // 坐标缺失，或所有文字块 Y 完全一样（无法分行）时，保持文档顺序，避免把整页挤成一行。
  const ys = positioned.map((item) => item.y)
  const span = ys.length ? Math.max(...ys) - Math.min(...ys) : 0
  if (positioned.length !== items.length || span === 0) {
    return [...items].sort((a, b) => a.order - b.order)
      .map((item) => item.text.replace(/\s+/g, ' ').trim()).filter(Boolean)
  }

  const sorted = [...positioned].sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.order - b.order))
  const rows = []
  for (const item of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(item.y - row.y) <= LINE_TOLERANCE) row.parts.push(item)
    else rows.push({ y: item.y, parts: [item] })
  }
  return rows
    .map((row) => row.parts.sort((a, b) => (a.x - b.x) || (a.order - b.order)).map((item) => item.text).join('')
      .replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** 页面内容文件：`.../Content.xml`。 */
function isPageContent(name) {
  return /(^|\/)Content\.xml$/i.test(name)
}

/** 页序：优先按 `Page_N/` 里的页码，其次按路径字典序。 */
function pageOrder(a, b) {
  const num = (name) => {
    const match = /Pages?[_-]?(\d+)/i.exec(name) || /_(\d+)\b/.exec(name)
    return match ? Number(match[1]) : 0
  }
  return (num(a.name) - num(b.name)) || a.name.localeCompare(b.name)
}

/** 一份 .ofd → 文本行数组（多页按页序拼接）。 */
export async function extractOfdText(bytes) {
  const pages = zipEntries(bytes).filter((entry) => isPageContent(entry.name)).sort(pageOrder)
  if (pages.length === 0) throw new Error('未找到页面内容（文件可能不是有效的 .ofd）')
  const lines = []
  for (const page of pages) lines.push(...ofdLinesFromXml(await entryText(page)))
  if (lines.length === 0) throw new Error('OFD 文档中未提取到文字（可能是图片/扫描版，请先 OCR 或改用文字版）')
  return lines
}

/**
 * 基本信息：页数与文档标题（OFD 通常没有标题，此时的调用方用文件名兜底）。
 * @returns `{ pages, title }`
 */
export async function extractOfdMeta(bytes) {
  const entries = zipEntries(bytes)
  const pages = entries.filter((entry) => isPageContent(entry.name)).length
  let title = ''
  const docXml = entries.find((entry) => /(^|\/)Document\.xml$/i.test(entry.name))
  if (docXml) {
    try {
      const xml = await entryText(docXml)
      const match = /<(?:[\w-]+:)?Title[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Title>/i.exec(xml)
      if (match) title = decodeEntities(match[1].replace(/<[^>]*>/g, '')).trim()
    } catch { /* 标题只是锦上添花，读不出来就留空 */ }
  }
  return { pages, title }
}
