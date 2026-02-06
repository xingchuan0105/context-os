// PDF Parser - using unpdf
import { getDocumentProxy } from 'unpdf'

export interface ParseResult {
  content: string
  mimeType?: string
  metadata?: Record<string, unknown>
}

/**
 * Extract text content from PDF file
 * @param buffer PDF file ArrayBuffer
 * @returns Parse result with text content and metadata
 */
export async function parsePDF(buffer: ArrayBuffer): Promise<ParseResult> {
  console.log('[PDF-PARSER] Starting PDF parse...')
  console.log('  - buffer size:', buffer.byteLength)

  // Check file header for PDF magic number
  const header = new Uint8Array(buffer.slice(0, 4))
  const headerStr = String.fromCharCode(...header)
  console.log('  - PDF magic number (first 4 bytes):', headerStr)

  if (headerStr !== '%PDF') {
    throw new Error('Invalid PDF file: missing PDF header')
  }

  // Use unpdf's getDocumentProxy
  const pdf = await getDocumentProxy(buffer)

  console.log('  - Parse complete')
  console.log('  - pages:', pdf.numPages)

  let fullText = ''

  // Extract text page by page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    // Merge text items - handle both TextItem and TextMarkedContent
    const pageText = textContent.items
      .map((item: unknown) => {
        // TextItem has 'str' property, TextMarkedContent has different structure
        if (item && typeof item === 'object' && 'str' in item) {
          return (item as { str: string }).str
        }
        return ''
      })
      .filter(Boolean)
      .join(' ')

    fullText += pageText + '\n\n'
  }

  console.log('  - text length:', fullText.length)
  console.log('  - text preview:', fullText.substring(0, 100) || '(empty)')

  return {
    content: fullText.trim(),
    metadata: {
      pages: pdf.numPages,
    },
  }
}
