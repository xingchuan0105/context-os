/**
 * 文档处理流程
 *
 * 完整的文档上传后处理流程：
 * 1. 从 COS 下载文件
 * 2. 解析文件内容
 * 3. K-Type 认知分析
 * 4. 父子分块
 * 5. Embedding 生成
 * 6. 三层写入 Qdrant
 *
 * @module lib/processors/document-processor
 */

import COS from 'cos-nodejs-sdk-v5'
import { v4 as uuidv4 } from 'uuid'
import {
  processKTypeWorkflowEfficient,
  type KTypeProcessResult,
  KTypeSafetyError,
} from './k-type-efficient-vercel'
import {
  splitIntoParentChildChunksBatch,
  splitIntoParentChildChunksStream,
} from '../chunkers/parent-child'
import embeddingClient from '../embedding'
import { ensureUserCollection, upsertPoints, type VectorPoint } from '../qdrant'
import {
  updateDocumentStatus,
  updateDocumentKType,
  type Document,
} from '../db/queries'
import { parsePDF } from '../parsers/pdf'
import { parseDOCX } from '../parsers/docx'
import { parseTXT } from '../parsers/text'
import { base64ToBuffer } from '../storage/local'
import { runSemchunk } from '../semchunk'
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
const KTYPE_MAX_TOKENS = ENV.KTYPE_MAX_TOKENS
const DOC_CHUNK_SIZE = ENV.DOC_CHUNK_SIZE
const DOC_CHUNK_OVERLAP = ENV.DOC_CHUNK_OVERLAP
const PARENT_CHUNK_SIZE = ENV.PARENT_CHUNK_SIZE
const PARENT_CHUNK_OVERLAP = parseIntEnv('PARENT_CHUNK_OVERLAP', 240)
const CHILD_CHUNK_SIZE = parseIntEnv('CHILD_CHUNK_SIZE', 420)
const CHILD_CHUNK_OVERLAP = parseIntEnv('CHILD_CHUNK_OVERLAP', 100)
const MEMORY_THRESHOLD_MB = parseIntEnv('MEMORY_THRESHOLD_MB', 0)
const MEMORY_LOG = parseBoolEnv('MEMORY_LOG', false)
const GC_AFTER_KTYPE = parseBoolEnv('GC_AFTER_KTYPE', false)
const GC_AFTER_CHUNKING = parseBoolEnv('GC_AFTER_CHUNKING', false)
const GC_AFTER_EMBEDDING = parseBoolEnv('GC_AFTER_EMBEDDING', false)
const CHUNK_STREAMING = parseBoolEnv('CHUNK_STREAMING', false)

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

function splitTextByLength(text: string, chunkSize: number, overlap: number): string[] {
  if (!text) return []
  if (chunkSize <= 0 || text.length <= chunkSize) return [text]
  const safeOverlap = Math.max(0, overlap)
  const step = Math.max(1, chunkSize - safeOverlap)
  const chunks: string[] = []

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(text.length, start + chunkSize)
    const chunk = text.slice(start, end)
    if (chunk.trim()) {
      chunks.push(chunk)
    }
    if (end >= text.length) break
  }

  return chunks.length > 0 ? chunks : [text]
}

function buildKTypeDocText(report: KTypeProcessResult['finalReport']): string {
  const fullReport = (report.distilledContent || '').trim()
  if (fullReport) return fullReport
  return (report.executiveSummary || '').trim()
}

// ==================== 类型定义 ====================

export interface ProcessingOptions {
  // K-Type 分析选项
  skipKType?: boolean

  // 分块选项
  docChunkSize?: number
  docChunkOverlap?: number
  parentChunkSize?: number
  parentChunkOverlap?: number
  childChunkSize?: number
  childChunkOverlap?: number

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
    docChunkSize = DOC_CHUNK_SIZE,
    docChunkOverlap = DOC_CHUNK_OVERLAP,
    parentChunkSize = PARENT_CHUNK_SIZE,
    parentChunkOverlap = PARENT_CHUNK_OVERLAP,
    childChunkSize = CHILD_CHUNK_SIZE,
    childChunkOverlap = CHILD_CHUNK_OVERLAP,
    embeddingBatchSize = 10,
  } = options

  try {
    console.log(`📄 [Processor] 开始处理文档: ${document.file_name} (docId=${document.id})`)
    console.log(`📥 [Processor] 文本内容长度: ${textContent.length} 字符`)

    // 1. K-Type 分析
    const ktypeResults: KTypeProcessResult[] = []
    if (!skipKType) {
      onProgress?.({
        documentId: document.id,
        status: 'ktype',
        progress: startProgress + 20,
        message: 'K-Type 分析中...',
      })

      try {
        const ktypeInputs = (await runSemchunk({ text: textContent }, KTYPE_MAX_TOKENS)) as string[]
        for (const part of ktypeInputs) {
          const result = await processKTypeWorkflowEfficient(part)
          ktypeResults.push(result)
        }
        if (ktypeResults.length > 0) {
          console.log(`✅ [Processor] K-Type 分析完成 (${ktypeResults.length} parts)`)
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
        try {
          const result = await processKTypeWorkflowEfficient(textContent)
          ktypeResults.push(result)
        } catch (fallbackError) {
          if (fallbackError instanceof KTypeSafetyError) {
            throw fallbackError
          }
          console.error(`❌ [Processor] K-Type 回退失败:`, fallbackError)
          throw new Error(`K-Type 分析失败: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`)
        }
      }
    }

    logMemoryUsage('after-ktype')
    maybeForceGc('after-ktype', GC_AFTER_KTYPE)

    // 2. 分块 (semchunk)
    const useChunkStreaming = CHUNK_STREAMING
    onProgress?.({
      documentId: document.id,
      status: 'chunking',
      progress: startProgress + 40,
      message: useChunkStreaming ? '分块处理中(流式)...' : '分块处理中...',
    })

    let parentChunks: Array<{ index: number; content: string }> = []
    let childChunks: Array<{ index: number; parentIndex: number; content: string }> = []
    let parentChunkCount = 0
    let childChunkCount = 0
    let chunkStream: AsyncIterable<{
      parentChunks: Array<{ index: number; content: string }>
      childChunks: Array<{ index: number; parentIndex: number; content: string }>
    }> | null = null

    if (!useChunkStreaming) {
      try {
        const parentTexts = (await runSemchunk(
          { text: textContent },
          parentChunkSize,
          parentChunkOverlap
        )) as string[]

        const childLists = (await runSemchunk(
          { texts: parentTexts },
          childChunkSize,
          childChunkOverlap
        )) as string[][]

        parentChunks = parentTexts.map((content, index) => ({ index, content }))
        let childIndex = 0
        for (let i = 0; i < childLists.length; i++) {
          for (const child of childLists[i] || []) {
            childChunks.push({ index: childIndex++, parentIndex: i, content: child })
          }
        }
      } catch (error) {
        console.warn('⚠️  [Processor] semchunk 分块失败，使用 fallback:', error)
        const fallback = await splitIntoParentChildChunksBatch(textContent, {
          parentChunkSize,
          parentChunkOverlap,
          childChunkSize,
          childChunkOverlap,
        })
        parentChunks = fallback.parentChunks
        childChunks = fallback.childChunks
      }

      parentChunkCount = parentChunks.length
      childChunkCount = childChunks.length
      console.log(
        `✅ [Processor] 分块完成: ${parentChunks.length} 父块, ${childChunks.length} 子块`
      )
    } else {
      console.log('📦 [Processor] 分块将使用流式模式')
      chunkStream = splitIntoParentChildChunksStream(textContent, {
        parentChunkSize,
        parentChunkOverlap,
        childChunkSize,
        childChunkOverlap,
      })
    }

    logMemoryUsage('after-chunking')
    maybeForceGc('after-chunking', GC_AFTER_CHUNKING)

    // 3. Embedding + Qdrant 写入
    onProgress?.({
      documentId: document.id,
      status: 'embedding',
      progress: startProgress + 50,
      message: '生成向量并写入数据库...',
    })

    const embeddingStartTime = Date.now()

    const combinedKTypeText = ktypeResults.length
      ? ktypeResults
          .map((r) => buildKTypeDocText(r.finalReport))
          .filter(Boolean)
          .join('\n\n')
      : ''

    const deepSummary = combinedKTypeText

    const docChunks: Array<{ content: string; report?: KTypeProcessResult['finalReport'] }> = []

    if (combinedKTypeText.trim()) {
      docChunks.push({ content: combinedKTypeText, report: ktypeResults[0]?.finalReport })
    } else if (textContent.trim()) {
      docChunks.push({ content: textContent })
    }

    if (docChunks.length === 0 && textContent) {
      docChunks.push({ content: textContent })
    }


    const totalEmbedTexts = useChunkStreaming
      ? 0
      : docChunks.length + parentChunks.length + childChunks.length
    const embeddingModel = process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b'
    let processedCount = 0

    await ensureUserCollection(document.user_id)

    const embedAndUpsert = async <T>(
      items: T[],
      getText: (item: T) => string,
      buildPoint: (item: T, index: number, vector: number[]) => VectorPoint
    ) => {
      for (let i = 0; i < items.length; i += embeddingBatchSize) {
        const batchItems = items.slice(i, i + embeddingBatchSize)
        const batchTexts = batchItems.map(getText)

        const response = await (embeddingClient as any).embeddings.create({
          model: embeddingModel,
          input: batchTexts,
        })

        const points = response.data.map((d: any, idx: number) =>
          buildPoint(batchItems[idx], i + idx, d.embedding)
        )

        await upsertPoints(document.user_id, points)

        processedCount += batchItems.length
        const progressIncrement =
          totalEmbedTexts > 0 ? Math.floor((processedCount / totalEmbedTexts) * 40) : 0
        onProgress?.({
          documentId: document.id,
          status: 'embedding',
          progress: startProgress + 50 + progressIncrement,
          message:
            totalEmbedTexts > 0
              ? `向量化进度: ${processedCount}/${totalEmbedTexts}`
              : `向量化进度: ${processedCount}`,
        })
      }
    }

    await embedAndUpsert(
      docChunks,
      (docChunk) => docChunk.content,
      (docChunk, index, vector) => ({
        id: uuidv4(),
        vector,
        payload: {
          doc_id: document.id,
          kb_id: document.kb_id,
          user_id: document.user_id,
          type: 'document',
          content: docChunk.content,
          chunk_index: index,
          metadata: {
            file_name: document.file_name,
          },
        },
      })
    )

    if (!useChunkStreaming) {
      await embedAndUpsert(
        parentChunks,
        (parentChunk) => parentChunk.content,
        (parentChunk, _index, vector) => ({
          id: uuidv4(),
          vector,
          payload: {
            doc_id: document.id,
            kb_id: document.kb_id,
            user_id: document.user_id,
            type: 'parent',
            content: parentChunk.content,
            chunk_index: parentChunk.index,
            metadata: {
              file_name: document.file_name,
            },
          },
        })
      )

      await embedAndUpsert(
        childChunks,
        (childChunk) => childChunk.content,
        (childChunk, _index, vector) => ({
          id: uuidv4(),
          vector,
          payload: {
            doc_id: document.id,
            kb_id: document.kb_id,
            user_id: document.user_id,
            type: 'child',
            parent_id: `parent_${document.id}_${childChunk.parentIndex}`,
            content: childChunk.content,
            chunk_index: childChunk.index,
            metadata: {
              file_name: document.file_name,
              parent_index: childChunk.parentIndex,
            },
          },
        })
      )
    } else if (chunkStream) {
      for await (const batch of chunkStream) {
        if (batch.parentChunks.length > 0) {
          parentChunkCount += batch.parentChunks.length
          await embedAndUpsert(
            batch.parentChunks,
            (parentChunk) => parentChunk.content,
            (parentChunk, _index, vector) => ({
              id: uuidv4(),
              vector,
              payload: {
                doc_id: document.id,
                kb_id: document.kb_id,
                user_id: document.user_id,
                type: 'parent',
                content: parentChunk.content,
                chunk_index: parentChunk.index,
                metadata: {
                  file_name: document.file_name,
                },
              },
            })
          )
        }

        if (batch.childChunks.length > 0) {
          childChunkCount += batch.childChunks.length
          await embedAndUpsert(
            batch.childChunks,
            (childChunk) => childChunk.content,
            (childChunk, _index, vector) => ({
              id: uuidv4(),
              vector,
              payload: {
                doc_id: document.id,
                kb_id: document.kb_id,
                user_id: document.user_id,
                type: 'child',
                parent_id: `parent_${document.id}_${childChunk.parentIndex}`,
                content: childChunk.content,
                chunk_index: childChunk.index,
                metadata: {
                  file_name: document.file_name,
                  parent_index: childChunk.parentIndex,
                },
              },
            })
          )
        }
      }

      console.log(`✅ [Processor] 分块完成: ${parentChunkCount} 父块, ${childChunkCount} 子块`)
    }

    const totalPoints = docChunks.length + parentChunkCount + childChunkCount
    const embeddingTime = Date.now() - embeddingStartTime
    recordTiming('embedding', embeddingTime)
    console.log(`✅ [Processor] 向量化完成: 耗时 ${(embeddingTime / 1000).toFixed(2)}s, ${totalPoints} 个向量点`)

    logMemoryUsage('after-embedding')
    maybeForceGc('after-embedding', GC_AFTER_EMBEDDING)

    // 4. 更新数据库
    await updateDocumentKType(
      document.id,
      combinedKTypeText,
      JSON.stringify(ktypeResults.map((r) => r.finalReport)),
      deepSummary,
      childChunkCount
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
