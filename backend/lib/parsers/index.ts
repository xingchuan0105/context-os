import { parsePDF } from './pdf'
import { parseDOCX } from './docx'
import { parseTXT } from './text'
import { parseMarkdown } from './markdown'
import {
  parseWithPyMuPDF,
  inspectPdfWithPyMuPDF,
  renderPdfToImages,
  renderPdfToImagesStream,
} from './pymupdf'
import { convertOfficeToPdf } from './office'
import { runVisionOcr, runVisionOcrStream } from './vision-ocr'
import { parseWebPage } from './webpage'
import type { ParseResult } from './pdf'
import type { WebPageParserOptions } from './webpage'
import { incrementCounter, recordTiming } from '../observability/metrics'

export type { ParseResult, WebPageParserOptions }

export type FileFormat = 'pdf' | 'docx' | 'txt' | 'md' | 'markdown' | 'ppt' | 'pptx'

/**
 * Parse a file buffer based on mime type or extension.
 * For PDF: detect text vs image; text path uses PyMuPDF extraction; image path uses DeepSeek-OCR via LiteLLM/SiliconFlow.
 * For PPT/PPTX: convert to PDF then follow PDF path.
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<ParseResult> {
  const ext = fileName?.split('.').pop()?.toLowerCase() || getExtFromMime(mimeType)
  const startedAt = Date.now()

  console.log('[PARSER] parseFile')
  console.log('  - fileName:', fileName)
  console.log('  - mimeType:', mimeType)
  console.log('  - ext:', ext)
  console.log('  - buffer size:', buffer.length)

  try {
    switch (ext) {
      case 'pdf':
        return await parsePdfSmart(buffer, fileName || 'input.pdf')

      case 'ppt':
      case 'pptx': {
        console.log('[PARSER] PPT -> PDF -> Vision/OCR pipeline (forced)')
        const pdfBuffer = convertOfficeToPdf(buffer, fileName || `input.${ext}`)
        return await parsePdfSmart(pdfBuffer, `${fileName || 'input'}.pdf`, { forceOcr: true })
      }

      case 'docx':
      case 'doc':
        console.log('[PARSER] using docx parser')
        return await parseDOCX(buffer)

      case 'txt':
        console.log('[PARSER] using txt parser')
        return await parseTXT(buffer)

      case 'md':
      case 'markdown':
        console.log('[PARSER] using markdown parser')
        return await parseMarkdown(buffer)

      default:
        throw new Error(`Unsupported file format: ${ext}`)
    }
  } catch (error) {
    incrementCounter('parse_error', 1, { ext: ext || 'unknown' })
    throw error
  } finally {
    recordTiming('parse', Date.now() - startedAt, { ext: ext || 'unknown' })
  }
}

async function parsePdfSmart(
  buffer: Buffer,
  fileName: string,
  options?: { forceOcr?: boolean }
): Promise<ParseResult> {
  const textRatioThreshold = parseFloat(process.env.PDF_TEXT_RATIO || '0.1')
  const usePyMuPDF = process.env.PYMUPDF_ENABLED !== 'false'
  const useImageStream = process.env.PYMUPDF_IMAGE_STREAM !== 'false'

  if (usePyMuPDF) {
    try {
      if (options?.forceOcr) {
        console.log('[PARSER] force OCR for PDF (source: PPT/PPTX)')
        if (useImageStream) {
          const images = renderPdfToImagesStream(buffer, fileName)
          const md = await runVisionOcrStream(images)
          return { content: md, mimeType: 'text/markdown' }
        }
        const images = renderPdfToImages(buffer, fileName)
        const md = await runVisionOcr(images)
        return { content: md, mimeType: 'text/markdown' }
      }

      const inspect = inspectPdfWithPyMuPDF(buffer, fileName)
      const ratio =
        inspect.total_pages > 0 ? inspect.text_pages / inspect.total_pages : 0
      const isImagePdf = ratio < textRatioThreshold

      console.log(
        `[PARSER] PDF inspection: text_pages=${inspect.text_pages}, total=${inspect.total_pages}, ratio=${ratio.toFixed(
          3
        )}, isImage=${isImagePdf}`
      )

      if (isImagePdf) {
        if (useImageStream) {
          const images = renderPdfToImagesStream(buffer, fileName, inspect.total_pages)
          const md = await runVisionOcrStream(images, inspect.total_pages)
          return { content: md, mimeType: 'text/markdown' }
        }
        const images = renderPdfToImages(buffer, fileName)
        const md = await runVisionOcr(images)
        return { content: md, mimeType: 'text/markdown' }
      }

      const pyResult = parseWithPyMuPDF(buffer, fileName)
      return { content: pyResult.content, mimeType: pyResult.mimeType }
    } catch (err) {
      console.warn('[PARSER] PyMuPDF pipeline failed, fallback to unpdf:', err)
    }
  }

  // Fallback: unpdf text extraction
  console.log('[PARSER] using unpdf (fallback)')
  return parsePDF(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  )
}

function getExtFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/x-markdown': 'md',
  }

  return mimeMap[mimeType] || 'txt'
}

/**
 * Check if file format is supported.
 */
export function isSupportedFormat(mimeType: string, fileName?: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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
  const supportedExts = ['pdf', 'ppt', 'pptx', 'docx', 'doc', 'txt', 'md', 'markdown']

  return supportedExts.includes(ext || '')
}

// ==================== Markdown helpers ====================

/**
 * Generate markdown file name with .md extension.
 */
export function toMarkdownFileName(originalFileName: string): string {
  const baseName = originalFileName.replace(/\.[^.]+$/, '')
  return `${baseName}.md`
}

/**
 * Format text content as markdown with metadata.
 */
export function formatAsMarkdown(
  content: string,
  originalFileName: string,
  metadata?: Record<string, unknown>
): string {
  const lines = [`# ${originalFileName}`, '', '---', '']

  if (metadata) {
    lines.push('## Metadata', '')
    for (const [key, value] of Object.entries(metadata)) {
      lines.push(`- **${key}**: ${value}`)
    }
    lines.push('', '---', '')
  }

  lines.push('## Content', '', content)

  return lines.join('\n')
}

export { parseWebPage }
