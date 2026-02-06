/**
 * 文档处理 Worker (函数计算版本)
 *
 * 从 lib/worker-three-layer.ts 提取的核心处理逻辑
 * 适配函数计算环境 (无 BullMQ 依赖)
 */

import { createClient } from '@supabase/supabase-js'
import embeddingClient from './embedding'
import { parseFile, parseWebPage as parseWebPageContent } from './parsers'
import { splitIntoParentChildChunksBatch } from './chunkers'
import { processKTypeWorkflowWithFallback } from './processors/k-type'
import { buildKTypeSummaryText, buildKTypeMetadata } from './processors/k-type-summary'
import {
  ensureUserCollection,
  batchUpsert,
  deleteDocumentChunks,
  type VectorPoint,
} from './qdrant'

// ==================== 配置 ====================

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ==================== 类型定义 ====================

interface IngestJobData {
  doc_id: string
  storage_path: string
  kb_id: string
  user_id: string
}

interface ProcessResult {
  success: boolean
  chunks_count: number
  doc_index?: number
}

// ==================== 工具函数 ====================

function logMemoryUsage(stage: string): void {
  const usage = process.memoryUsage()
  console.log(
    `💾 [MEM] ${stage}: RSS=${Math.round(usage.rss / 1024 / 1024)}MB, ` +
    `Heap=${Math.round(usage.heapUsed / 1024 / 1024)}MB`
  )
}

async function updateDocStatus(
  docId: string,
  status: string,
  extra?: object
): Promise<void> {
  await supabase.from('documents').update({ status, ...extra }).eq('id', docId)
}

// ==================== ID 分配策略 ====================

class QdrantIdGenerator {
  private docIndex: number
  private readonly DOCUMENT_BASE = 1_000_000
  private readonly PARENT_MULTIPLIER = 10_000
  private readonly CHILD_MULTIPLIER = 100

  constructor(docIndex: number) {
    this.docIndex = docIndex
  }

  getDocumentId(): number {
    return this.DOCUMENT_BASE + this.docIndex
  }

  getParentId(parentIndex: number): number {
    return this.docIndex * this.PARENT_MULTIPLIER + parentIndex
  }

  getChildId(parentIndex: number, childIndex: number): number {
    return this.docIndex * this.PARENT_MULTIPLIER + parentIndex * this.CHILD_MULTIPLIER + childIndex
  }
}

// ==================== 主处理函数 ====================

export async function processDocument(jobData: IngestJobData): Promise<ProcessResult> {
  const { doc_id, storage_path, kb_id, user_id } = jobData

  logMemoryUsage('processDocument-start')
  await updateDocStatus(doc_id, 'processing')

  try {
    // 1. 从 Supabase Storage 下载文件
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storage_path)

    if (downloadError || !fileData) {
      throw new Error(`下载失败: ${downloadError?.message}`)
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const fileName = storage_path.split('/').pop() || 'unknown'

    // 2. 解析文件内容
    let text = ''
    const mimeType = fileData.type || ''

    const parsed = await parseFile(buffer, mimeType, fileName)
    text = parsed.content

    // 释放 buffer
    ;(buffer as any).fill?.(0)

    if (!text.trim()) {
      throw new Error('文档内容为空')
    }

    logMemoryUsage('after-parsing')

    // 3. K-Type 分析 (对整篇原文)
    console.log(`🔍 [K-Type] 开始分析文档...`)
    const ktypeResult = await processKTypeWorkflowWithFallback(text)

    // 生成 K-Type 摘要文本 (用于文档级向量)
    const ktypeSummary = buildKTypeSummaryText(ktypeResult)

    // 生成 K-Type 元数据
    const ktypeMetadata = buildKTypeMetadata(ktypeResult)

    console.log(`📊 [K-Type] 主导类型: ${ktypeMetadata.dominant_type}`)
    console.log(`📝 [K-Type] 摘要长度: ${ktypeSummary.length} 字符`)

    logMemoryUsage('after-ktype')

    // 4. 父子分块
    const { parentChunks, childChunks } = await splitIntoParentChildChunksBatch(text, {
      parentChunkSize: 1024,
      childChunkSize: 256,
      removeExtraSpaces: true,
      removeUrlsEmails: true,
    })

    console.log(`📦 [Chunk] 父块: ${parentChunks.length}, 子块: ${childChunks.length}`)
    logMemoryUsage('after-chunking')

    // 5. 确保 Qdrant collection 存在
    const collectionName = await ensureUserCollection(user_id)
    console.log(`📦 [Qdrant] 使用 collection: ${collectionName}`)

    // 6. 准备三层嵌入内容
    const docIndex = Date.now() % 10000
    const idGen = new QdrantIdGenerator(docIndex)

    const textsToEmbed: string[] = [
      ktypeSummary,
      ...parentChunks.map(p => p.content),
      ...childChunks.map(c => c.content),
    ]

    console.log(`🔄 [Embed] 准备嵌入 ${textsToEmbed.length} 个文本块`)

    // 7. 批量生成向量嵌入
    const embeddingModel = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3'
    const batchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '50')

    const allEmbeddings: number[][] = []

    for (let i = 0; i < textsToEmbed.length; i += batchSize) {
      const batch = textsToEmbed.slice(i, i + batchSize)

      const embeddingResponse = await embeddingClient.embeddings.create({
        model: embeddingModel,
        input: batch,
      })

      allEmbeddings.push(...embeddingResponse.data.map(d => d.embedding))
      console.log(`✅ 批次 ${Math.floor(i / batchSize) + 1}: ${embeddingResponse.data.length} 个向量`)
    }

    // 8. 准备 Qdrant 向量点
    const points: VectorPoint[] = []
    let embedIndex = 0

    // 8.1 文档级向量点
    points.push({
      id: idGen.getDocumentId(),
      vector: allEmbeddings[embedIndex++],
      payload: {
        doc_id,
        kb_id,
        user_id,
        type: 'document',
        content: ktypeSummary,
        chunk_index: 0,
        metadata: {
          ktype: ktypeMetadata,
        },
      },
    })

    // 8.2 父块向量点
    for (const parent of parentChunks) {
      points.push({
        id: idGen.getParentId(parent.index),
        vector: allEmbeddings[embedIndex++],
        payload: {
          doc_id,
          kb_id,
          user_id,
          type: 'parent',
          content: parent.content,
          chunk_index: parent.index,
          metadata: {
            file_name: fileName,
          },
        },
      })
    }

    // 8.3 子块向量点
    for (const child of childChunks) {
      const parentQdrantId = idGen.getParentId(child.parentIndex)

      points.push({
        id: idGen.getChildId(child.parentIndex, child.index),
        vector: allEmbeddings[embedIndex++],
        payload: {
          doc_id,
          kb_id,
          user_id,
          type: 'child',
          parent_id: parentQdrantId,
          content: child.content,
          chunk_index: child.index,
          metadata: {
            file_name: fileName,
            parent_index: child.parentIndex,
          },
        },
      })
    }

    console.log(`📦 [Qdrant] 准备了 ${points.length} 个向量点`)

    // 9. 批量插入 Qdrant
    await batchUpsert(user_id, points, batchSize)
    console.log(`✅ [Qdrant] 成功插入 ${points.length} 个向量点`)

    // 清理
    ;(textsToEmbed as any).length = 0
    ;(allEmbeddings as any).length = 0
    ;(points as any).length = 0

    if (global.gc) {
      global.gc()
    }

    logMemoryUsage('after-embedding')

    // 10. 更新数据库记录
    await updateDocStatus(doc_id, 'completed', {
      deep_summary: ktypeResult.finalReport,
      ktype_summary: ktypeSummary,
      ktype_metadata: ktypeMetadata as any,
      chunk_count: parentChunks.length + childChunks.length,
    })

    return {
      success: true,
      chunks_count: points.length,
      doc_index: docIndex,
    }
  } catch (error: any) {
    const message = error.message || '未知错误'
    console.error('❌ [ERROR] 文档处理失败!')
    console.error('  - doc_id:', doc_id)
    console.error('  - error:', message)

    await updateDocStatus(doc_id, 'failed', { error_message: message })

    // 清理 Qdrant 中的数据
    try {
      await deleteDocumentChunks(user_id, doc_id)
      console.log(`🧹 [Qdrant] 已清理文档 ${doc_id} 的向量数据`)
    } catch (e) {
      console.error('清理 Qdrant 数据失败:', e)
    }

    throw error
  }
}

/**
 * 处理网页内容
 */
export async function processWebPage(jobData: IngestJobData): Promise<ProcessResult> {
  const { doc_id, storage_path: url, kb_id, user_id } = jobData

  await updateDocStatus(doc_id, 'processing')

  try {
    // 获取网页内容
    const { content } = await parseWebPageContent(url, { method: 'jina' })

    if (!content.trim()) {
      throw new Error('网页内容为空')
    }

    // K-Type 分析
    const ktypeResult = await processKTypeWorkflowWithFallback(content)
    const ktypeSummary = buildKTypeSummaryText(ktypeResult)
    const ktypeMetadata = buildKTypeMetadata(ktypeResult)

    // 父子分块
    const { parentChunks, childChunks } = await splitIntoParentChildChunksBatch(content, {
      parentChunkSize: 1024,
      childChunkSize: 256,
      removeExtraSpaces: true,
      removeUrlsEmails: true,
    })

    await ensureUserCollection(user_id)

    const docIndex = Date.now() % 10000
    const idGen = new QdrantIdGenerator(docIndex)

    const textsToEmbed: string[] = [
      ktypeSummary,
      ...parentChunks.map(p => p.content),
      ...childChunks.map(c => c.content),
    ]

    const embeddingModel = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3'
    const batchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '50')

    const allEmbeddings: number[][] = []

    for (let i = 0; i < textsToEmbed.length; i += batchSize) {
      const batch = textsToEmbed.slice(i, i + batchSize)

      const embeddingResponse = await embeddingClient.embeddings.create({
        model: embeddingModel,
        input: batch,
      })

      allEmbeddings.push(...embeddingResponse.data.map(d => d.embedding))
    }

    const points: VectorPoint[] = []
    let embedIndex = 0

    // Document
    points.push({
      id: idGen.getDocumentId(),
      vector: allEmbeddings[embedIndex++],
      payload: {
        doc_id,
        kb_id,
        user_id,
        type: 'document',
        content: ktypeSummary,
        chunk_index: 0,
        metadata: { ktype: ktypeMetadata, source_url: url },
      },
    })

    // Parents
    for (const parent of parentChunks) {
      points.push({
        id: idGen.getParentId(parent.index),
        vector: allEmbeddings[embedIndex++],
        payload: {
          doc_id,
          kb_id,
          user_id,
          type: 'parent',
          content: parent.content,
          chunk_index: parent.index,
          metadata: { source_url: url },
        },
      })
    }

    // Children
    for (const child of childChunks) {
      const parentQdrantId = idGen.getParentId(child.parentIndex)
      points.push({
        id: idGen.getChildId(child.parentIndex, child.index),
        vector: allEmbeddings[embedIndex++],
        payload: {
          doc_id,
          kb_id,
          user_id,
          type: 'child',
          parent_id: parentQdrantId,
          content: child.content,
          chunk_index: child.index,
          metadata: { source_url: url, parent_index: child.parentIndex },
        },
      })
    }

    await batchUpsert(user_id, points, batchSize)
    console.log(`✅ [Qdrant] 网页: 成功插入 ${points.length} 个向量点`)

    ;(textsToEmbed as any).length = 0
    ;(allEmbeddings as any).length = 0
    ;(points as any).length = 0

    await updateDocStatus(doc_id, 'completed', {
      deep_summary: ktypeResult.finalReport,
      ktype_summary: ktypeSummary,
      ktype_metadata: ktypeMetadata as any,
      chunk_count: parentChunks.length + childChunks.length,
    })

    return { success: true, chunks_count: points.length }
  } catch (error: any) {
    const message = error.message || '未知错误'
    await updateDocStatus(doc_id, 'failed', { error_message: message })
    throw error
  }
}
