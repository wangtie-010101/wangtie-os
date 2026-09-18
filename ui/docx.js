/**
 * 王铁 OS — Word（.docx）正文提取。
 *
 * .docx 本质是 ZIP：读 `word/document.xml`，把段落/换行/制表符映射成纯文本行。
 * 依赖 ./zip.js 的 ZIP 读取（存储/DEFLATE 都支持）。
 */

import { entryText, zipEntries } from './zip.js'

export async function extractDocxText(bytes) {
  const entry = zipEntries(bytes).find((item) => item.name === 'word/document.xml')
  if (!entry) throw new Error('未找到 word/document.xml（文件可能不是有效的 .docx）')
  const xml = await entryText(entry)
  const text = xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
}
