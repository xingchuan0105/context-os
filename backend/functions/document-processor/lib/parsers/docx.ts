// DOCX 解析器
import mammoth from 'mammoth'

export interface ParseResult {
  content: string
  metadata?: Record<string, unknown>
}

export async function parseDOCX(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer })

  return {
    content: result.value,
    metadata: {
      messages: result.messages,
    },
  }
}
