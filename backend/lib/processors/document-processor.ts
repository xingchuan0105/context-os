/**
 * 文档处理流程
 *
 * 完整的文档上传后处理流程：
 * 1. 从 COS 下载文件
 * 2. 解析文件内容
 * 3. semchunk 语义分块并生成稳定 chunk_id
 * 4. K-Type 认知分析（支持超长分批）
 * 5. 生成文档级摘要与分块元数据（Agentic 检索使用）
 *
 * @module lib/processors/document-processor
 */

import COS from 'cos-nodejs-sdk-v5'
import {
  processKTypeWorkflowEfficient,
  type KTypeProcessResult,
  KTypeSafetyError,
} from './k-type-efficient-vercel'
import {
  updateDocumentStatus,
  updateDocumentKType,
  type Document,
} from '../db/queries'
import { parsePDF } from '../parsers/pdf'
import { parseDOCX } from '../parsers/docx'
import { parseTXT } from '../parsers/text'
import { base64ToBuffer } from '../storage/local'
import { estimateTokens, runSemchunk } from '../semchunk'
import { downloadFileFromCOS } from '../storage/cos'
import { incrementCounter, recordTiming } from '../observability/metrics'
import { ENV, parseIntEnv, parseBoolEnv } from '../config/env-helpers'

// ==================== 配置 ====================

const cos = new COS({
  SecretId: process.env.TENCENT_COS_SECRET_ID || '',
  SecretKey: process.env.TENCENT_COS_SECRET_KEY || '',
})

const BUCKET = process.env.TENCENT_COS_BUCKET || ''
const REGION = process.env.TENCENT_COS_REGION || 'ap-guangzhou'

// 使用统一的环境变量解析工具
const SUMMARY_SEGMENT_MAX_TOKENS = ENV.SUMMARY_SEGMENT_MAX_TOKENS
const KTYPE_BATCH_TOKEN_BUDGET = Math.max(1, ENV.KTYPE_MAX_TOKENS)
const KTYPE_SEMCHUNK_CHUNK_TOKENS = Math.max(
  1,
  Math.min(ENV.KTYPE_SEMCHUNK_CHUNK_TOKENS, KTYPE_BATCH_TOKEN_BUDGET),
)
const MEMORY_THRESHOLD_MB = parseIntEnv('MEMORY_THRESHOLD_MB', 0)
const MEMORY_LOG = parseBoolEnv('MEMORY_LOG', false)
const GC_AFTER_KTYPE = parseBoolEnv('GC_AFTER_KTYPE', false)
const GC_AFTER_CHUNKING = parseBoolEnv('GC_AFTER_CHUNKING', false)
const GC_AFTER_EMBEDDING = parseBoolEnv('GC_AFTER_EMBEDDING', false)

function logMemoryUsage(stage: string): void {
  if (!MEMORY_LOG) return
  const usage = process.memoryUsage()
  const rssMB = Math.round(usage.rss / 1024 / 1024)
  const heapMB = Math.round(usage.heapUsed / 1024 / 1024)
  console.log(`💾 [MEM] ${stage}: RSS=${rssMB}MB Heap=${heapMB}MB`)
}

function maybeForceGc(stage: string, force = false): void {
  if (typeof global.gc !== 'function') {
    return
  }

  const usage = process.memoryUsage()
  const rssMB = Math.round(usage.rss / 1024 / 1024)
  const shouldGc = force || (MEMORY_THRESHOLD_MB > 0 && rssMB >= MEMORY_THRESHOLD_MB)

  if (!shouldGc) {
    return
  }

  console.log(`🧹 [GC] ${stage}: rss=${rssMB}MB`)
  global.gc()
  logMemoryUsage(`${stage}-after-gc`)
}

function buildKTypeDocText(report: KTypeProcessResult['finalReport']): string {
  const fullReport = (report.distilledContent || '').trim()
  if (fullReport) return fullReport
  return (report.executiveSummary || '').trim()
}

function splitSummarySegmentsByWindow(text: string, maxTokensPerSegment: number): string[] {
  const normalizedText = text.trim()
  if (!normalizedText) return []
  const tokenBudget = Math.max(1000, maxTokensPerSegment)
  const totalTokens = estimateTokens(normalizedText)
  const partCount = Math.max(1, Math.ceil(totalTokens / tokenBudget))
  if (partCount <= 1) return [normalizedText]

  const targetChars = Math.ceil(normalizedText.length / partCount)
  const parts: string[] = []
  let cursor = 0

  for (let i = 0; i < partCount && cursor < normalizedText.length; i += 1) {
    if (i === partCount - 1) {
      const tail = normalizedText.slice(cursor).trim()
      if (tail) parts.push(tail)
      break
    }

    const preferredEnd = Math.min(normalizedText.length, cursor + targetChars)
    const windowStart = Math.max(cursor + Math.floor(targetChars * 0.7), cursor + 1)
    const windowEnd = Math.min(normalizedText.length, cursor + Math.floor(targetChars * 1.3))
    let splitAt = preferredEnd

    for (let p = preferredEnd; p >= windowStart; p -= 1) {
      const ch = normalizedText[p]
      if (ch === '\n' || ch === '。' || ch === '！' || ch === '？' || ch === ';' || ch === '.') {
        splitAt = p + 1
        break
      }
    }

    if (splitAt === preferredEnd) {
      for (let p = preferredEnd; p <= windowEnd; p += 1) {
        const ch = normalizedText[p]
        if (ch === '\n' || ch === '。' || ch === '！' || ch === '？' || ch === ';' || ch === '.') {
          splitAt = p + 1
          break
        }
      }
    }

    const chunk = normalizedText.slice(cursor, splitAt).trim()
    if (chunk) {
      parts.push(chunk)
    }
    cursor = Math.max(splitAt, cursor + 1)
  }

  return parts.length > 0 ? parts : [normalizedText]
}

type SemanticChunkCard = {
  chunkId: string
  content: string
  tokenCount: number
}

function toSemanticChunkId(index: number): string {
  return `c${String(index + 1).padStart(4, '0')}`
}

async function buildSemanticChunkCards(text: string): Promise<SemanticChunkCard[]> {
  const normalized = text.trim()
  if (!normalized) return []
  let chunks: string[] = []
  try {
    chunks = (await runSemchunk({ text: normalized }, KTYPE_SEMCHUNK_CHUNK_TOKENS)) as string[]
  } catch (error) {
    console.warn('⚠️  [Processor] semchunk 语义分块失败，fallback 为单块:', error)
    chunks = [normalized]
  }

  return chunks
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content, index) => ({
      chunkId: toSemanticChunkId(index),
      content,
      tokenCount: estimateTokens(content),
    }))
}

// ==================== 类型定义 ====================

export interface ProcessingOptions {
  // K-Type 分析选项
  skipKType?: boolean

  // Embedding 选项
  embeddingBatchSize?: number
}

export interface ProcessingResult {
  success: boolean
  documentId: string
  processed: boolean
  error?: string
  stats?: {
    textLength: number
    parentChunks: number
    childChunks: number
    embeddingTime: number
  }
}

export interface ProcessingProgress {
  documentId: string
  status: 'downloading' | 'parsing' | 'ktype' | 'chunking' | 'embedding' | 'qdrant' | 'completed' | 'failed'
  progress: number // 0-100
  message: string
  error?: string
}

// ==================== 主处理流程 ====================

/**
 * 核心文档处理流程（统一的内部实现）
 *
 * 这个函数包含了所有文档处理的核心逻辑，避免代码重复
 * 两个公共接口 processDocument 和 processDocumentWithText 都调用这个函数
 *
 * @param document - 文档信息
 * @param textContent - 文本内容（已提取）
 * @param options - 处理选项
 * @param onProgress - 进度回调
 * @param startProgress - 起始进度值（用于不同入口的进度调整）
 * @returns 处理结果
 */
async function processDocumentCore(
  document: Document,
  textContent: string,
  options: ProcessingOptions,
  onProgress?: (progress: ProcessingProgress) => void,
  startProgress = 0
): Promise<ProcessingResult> {
  const {
    skipKType = false,
  } = options

  try {
    console.log(`📄 [Processor] 开始处理文档: ${document.file_name} (docId=${document.id})`)
    console.log(`📥 [Processor] 文本内容长度: ${textContent.length} 字符`)

    // 1. K-Type 分析
    const ktypeResults: KTypeProcessResult[] = []
    let ktypeInputs: string[] = []
    if (!skipKType) {
      onProgress?.({
        documentId: document.id,
        status: 'ktype',
        progress: startProgress + 20,
        message: 'K-Type 分析中...',
      })

      try {
        ktypeInputs = [textContent]
        const result = await processKTypeWorkflowEfficient(textContent)
        ktypeResults.push(result)
        if (ktypeResults.length > 0) {
          console.log(`✅ [Processor] K-Type 分析完成`)
          console.log(
            `   主导类型: ${ktypeResults[0].finalReport.classification.dominantType.join(', ')}`
          )
          console.log(`   知识模块: ${ktypeResults[0].finalReport.knowledgeModules.length} 个`)
        }
      } catch (error) {
        if (error instanceof KTypeSafetyError) {
          console.error(`❌ [Processor] K-Type 被内容安全审核拦截:`, error.message)
          throw error
        }
        console.warn(`⚠️  [Processor] K-Type 分析失败，使用回退策略:`, error)
        throw new Error(`K-Type 分析失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    logMemoryUsage('after-ktype')
    maybeForceGc('after-ktype', GC_AFTER_KTYPE)

    // 2. 分块
    onProgress?.({
      documentId: document.id,
      status: 'chunking',
      progress: startProgress + 40,
      message: '分块处理中...',
    })

    let semanticChunkCards: SemanticChunkCard[] = []
    let parentChunkCount = 0
    let childChunkCount = 0

    semanticChunkCards = await buildSemanticChunkCards(textContent)
    parentChunkCount = semanticChunkCards.length
    childChunkCount = semanticChunkCards.length
    console.log(`✅ [Processor] 语义分块完成: ${semanticChunkCards.length} 块`)

    logMemoryUsage('after-chunking')
    maybeForceGc('after-chunking', GC_AFTER_CHUNKING)

    // 3. Agentic 模式不做向量化写入，仅保留处理阶段用于兼容旧进度状态。
    onProgress?.({
      documentId: document.id,
      status: 'embedding',
      progress: startProgress + 50,
      message: 'Agentic 模式：跳过向量化写入',
    })

    const combinedKTypeText = ktypeResults.length
      ? ktypeResults
          .map((r) => buildKTypeDocText(r.finalReport))
          .filter(Boolean)
          .join('\n\n')
      : ''
    const summarySegments = ktypeResults.length
      ? ktypeResults.map((result, index) => {
          const summary = buildKTypeDocText(result.finalReport)
          return {
            index,
            summary,
            sourceTokens: estimateTokens(ktypeInputs[index] || ''),
            summaryTokens: estimateTokens(summary),
          }
        })
      : splitSummarySegmentsByWindow(textContent, SUMMARY_SEGMENT_MAX_TOKENS).map((segment, index) => ({
          index,
          summary: segment,
          sourceTokens: estimateTokens(segment),
          summaryTokens: estimateTokens(segment),
        }))

    const summaryGlobal =
      combinedKTypeText.trim() ||
      summarySegments.map((segment) => segment.summary).filter(Boolean).join('\n\n') ||
      textContent.slice(0, 20000)

    const deepSummary = summaryGlobal

    const summarySegmentsPayload = {
      schema: 'agentic_semchunk_v1',
      summary_batches: summarySegments,
      semantic_chunks: semanticChunkCards.map((item) => ({
        chunk_id: item.chunkId,
        content: item.content,
        token_count: item.tokenCount,
      })),
    }

    const embeddingTime = 0
    recordTiming('embedding', embeddingTime)
    console.log('✅ [Processor] Agentic 模式已跳过向量化与 Qdrant 写入')

    logMemoryUsage('after-embedding')
    maybeForceGc('after-embedding', GC_AFTER_EMBEDDING)

    // 4. 更新数据库
    await updateDocumentKType(
      document.id,
      combinedKTypeText,
      JSON.stringify(ktypeResults.map((r) => r.finalReport)),
      deepSummary,
      semanticChunkCards.length,
      {
        summaryGlobal,
        summarySegmentsJson: JSON.stringify(summarySegmentsPayload),
      },
    )

    onProgress?.({
      documentId: document.id,
      status: 'completed',
      progress: 100,
      message: '处理完成',
    })

    console.log(`✨ [Processor] 文档处理完成: ${document.file_name}`)

    return {
      success: true,
      documentId: document.id,
      processed: true,
      stats: {
        textLength: textContent.length,
        parentChunks: parentChunkCount,
        childChunks: childChunkCount,
        embeddingTime,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    incrementCounter('document_process_error')
    console.error(`❌ [Processor] 处理失败:`, error)

    // 更新文档状态为失败
    await updateDocumentStatus(document.id, 'failed', errorMessage)

    onProgress?.({
      documentId: document.id,
      status: 'failed',
      progress: 0,
      message: '处理失败',
      error: errorMessage,
    })

    return {
      success: false,
      documentId: document.id,
      processed: false,
      error: errorMessage,
    }
  }
}

/**
 * 处理文档的完整流程（使用已提取的文本内容）
 *
 * 新的推荐方式：上传时立即解析文件，直接传递文本内容
 * 跳过文件下载和解析步骤，提高效率
 *
 * @param document - 文档信息
 * @param extractedText - 已提取的文本内容
 * @param options - 处理选项
 * @param onProgress - 进度回调
 */
export async function processDocumentWithText(
  document: Document,
  extractedText: string,
  options: ProcessingOptions = {},
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> {
  console.log(`📄 [Processor] 使用已提取文本处理文档: ${document.file_name} (${extractedText.length} 字符)`)

  // 直接调用核心处理函数，起始进度为 0
  return processDocumentCore(document, extractedText, options, onProgress, 0)
}

/**
 * 处理文档的完整流程（兼容旧版本，需要下载文件）
 *
 * @param document - 文档信息
 * @param options - 处理选项
 * @param onProgress - 进度回调
 */
export async function processDocument(
  document: Document,
  options: ProcessingOptions = {},
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> {
  try {
    console.log(`🚀 [Processor] Start processing document ${document.file_name} (docId=${document.id})`)

    // 1. Download file content
    onProgress?.({
      documentId: document.id,
      status: 'downloading',
      progress: 10,
      message: document.file_content ? 'Reading from local storage...' : 'Downloading from COS...',
    })

    let fileBuffer: Buffer
    if (document.file_content) {
      fileBuffer = base64ToBuffer(document.file_content)
    } else {
      fileBuffer = await downloadFileFromCOS(document.storage_path)
    }

    // 2. Parse file content
    onProgress?.({
      documentId: document.id,
      status: 'parsing',
      progress: 20,
      message: 'Parsing document content...',
    })

    const { content } = await parseFile(fileBuffer, document.file_name, document.mime_type)
    console.log(`✅ [Processor] Parsed ${content.length} chars`)

    // Delegate to the unified core pipeline
    return await processDocumentCore(document, content, options, onProgress, 20)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    incrementCounter('document_process_error')
    console.error('❌ [Processor] Processing failed:', error)

    await updateDocumentStatus(document.id, 'failed', errorMessage)

    onProgress?.({
      documentId: document.id,
      status: 'failed',
      progress: 0,
      message: 'Processing failed',
      error: errorMessage,
    })

    return {
      success: false,
      documentId: document.id,
      processed: false,
      error: errorMessage,
    }
  }
}
async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null
): Promise<{ content: string; mimeType: string }> {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const detectedMimeType = mimeType || detectMimeType(fileName)

  // 根据文件类型选择解析器
  if (ext === 'pdf' || detectedMimeType === 'application/pdf') {
    const result = await parsePDF(buffer.buffer as ArrayBuffer)
    return { content: result.content, mimeType: 'application/pdf' }
  }

  if (
    ext === 'docx' ||
    detectedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await parseDOCX(buffer)
    return { content: result.content, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  }

  // 默认按文本处理
  const result = await parseTXT(buffer)
  return { content: result.content, mimeType: detectedMimeType || 'text/plain' }
}

/**
 * 根据文件名检测 MIME 类型
 */
function detectMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()

  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
  }

  return mimeMap[ext || ''] || 'text/plain'
}

// ==================== 导出 ====================

/**
 * 触发文档处理（供 API 调用）
 *
 * 这个函数设计为异步触发，不阻塞 API 响应
 */
export async function triggerDocumentProcessing(
  documentId: string,
  options?: ProcessingOptions
): Promise<{ documentId: string; status: string }> {
  // 异步处理，不等待完成
  processDocumentAsync(documentId, options).catch((error) => {
    console.error(`[Processor] 异步处理失败 (docId=${documentId}):`, error)
  })

  return {
    documentId,
    status: 'processing',
  }
}

/**
 * 异步处理文档（内部函数）
 */
async function processDocumentAsync(
  documentId: string,
  options?: ProcessingOptions
): Promise<void> {
  // 这里我们无法直接访问数据库获取文档信息
  // 因为这个函数是异步调用的
  // 实际实现需要在调用方传入完整文档信息
  // 或者通过数据库查询获取

  // 简化实现：由调用方负责传入完整信息
  console.log(`[Processor] 异步处理已触发: docId=${documentId}`)
}
