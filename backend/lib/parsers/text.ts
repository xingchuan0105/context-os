// TXT 解析器

export interface ParseResult {
  content: string
  metadata?: Record<string, unknown>
}

export async function parseTXT(buffer: Buffer): Promise<ParseResult> {
  return {
    content: buffer.toString('utf-8'),
    metadata: {
      encoding: 'utf-8',
    },
  }
}
