// Markdown 解析器
// Markdown 直接作为文本处理，保留格式

export interface ParseResult {
  content: string
  metadata?: Record<string, unknown>
}

export async function parseMarkdown(buffer: Buffer): Promise<ParseResult> {
  const text = buffer.toString('utf-8')

  return {
    content: text,
    metadata: {
      format: 'markdown',
    },
  }
}
