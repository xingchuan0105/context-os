// 文件解析器统一入口
import { parsePDF } from './pdf'
import { parseDOCX } from './docx'
import { parseTXT } from './text'
import { parseMarkdown } from './markdown'
import type { ParseResult } from './pdf'

export type { ParseResult }

export type FileFormat = 'pdf' | 'docx' | 'txt' | 'md' | 'markdown'

/**
 * 根据 MIME 类型或扩展名解析文件
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<ParseResult> {
  const ext = fileName?.split('.').pop()?.toLowerCase() || getExtFromMime(mimeType)

  // ========== 调试日志 ==========
  console.log('📖 [PARSER] parseFile 被调用')
  console.log('  - fileName:', fileName)
  console.log('  - mimeType:', JSON.stringify(mimeType))
  console.log('  - getExtFromMime(mimeType):', getExtFromMime(mimeType))
  console.log('  - ext from fileName:', fileName?.split('.').pop()?.toLowerCase())
  console.log('  - 最终 ext:', ext)
  console.log('  - buffer size:', buffer.length)
  // ========== 调试日志结束 ==========

  switch (ext) {
    case 'pdf':
      console.log('✅ [PARSER] 使用 PDF 解析器')
      // unpdf 需要 ArrayBuffer，Node.js Buffer 可直接转换
      return parsePDF(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)

    case 'docx':
    case 'doc':
      console.log('✅ [PARSER] 使用 DOCX 解析器')
      return parseDOCX(buffer)

    case 'txt':
      console.log('✅ [PARSER] 使用 TXT 解析器')
      return parseTXT(buffer)

    case 'md':
    case 'markdown':
      console.log('✅ [PARSER] 使用 Markdown 解析器')
      return parseMarkdown(buffer)

    default:
      console.error('❌ [PARSER] 不支持的文件格式:', ext)
      throw new Error(`Unsupported file format: ${ext}`)
  }
}

function getExtFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/x-markdown': 'md',
  }

  return mimeMap[mimeType] || 'txt'
}

/**
 * 检查文件格式是否支持
 */
export function isSupportedFormat(mimeType: string, fileName?: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
  ]

  if (supportedTypes.includes(mimeType)) {
    return true
  }

  const ext = fileName?.split('.').pop()?.toLowerCase()
  const supportedExts = ['pdf', 'docx', 'doc', 'txt', 'md', 'markdown']

  return supportedExts.includes(ext || '')
}

export { parseWebPage } from './webpage'
export type { WebPageParserOptions } from './webpage'

// ==================== Markdown 转换工具 ====================

/**
 * 生成 Markdown 文件名
 * 将原始文件名转换为 .md 扩展名
 */
export function toMarkdownFileName(originalFileName: string): string {
  const baseName = originalFileName.replace(/\.[^.]+$/, '') // 移除原扩展名
  return `${baseName}.md`
}

/**
 * 将文本内容格式化为 Markdown
 */
export function formatAsMarkdown(
  content: string,
  originalFileName: string,
  metadata?: Record<string, unknown>
): string {
  const lines = [
    `# ${originalFileName}`,
    '',
    '---',
    '',
  ]

  // 添加元数据（如果有）
  if (metadata) {
    lines.push('## 元数据', '')
    for (const [key, value] of Object.entries(metadata)) {
      lines.push(`- **${key}**: ${value}`)
    }
    lines.push('', '---', '')
  }

  // 添加正文内容
  lines.push('## 正文', '')
  lines.push(content)

  return lines.join('\n')
}
