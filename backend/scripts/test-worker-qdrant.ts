#!/usr/bin/env tsx
/**
 * 简化的 Qdrant Worker 测试
 * 直接调用 Worker 处理函数，避免内存问题
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import { Queue } from 'bullmq'
import embeddingClient from '../lib/embedding.js'
import { splitIntoParentChildChunksBatch } from '../lib/chunkers/index.js'
import { processKTypeWorkflowWithFallback } from '../lib/processors/k-type.js'
import {
  ensureUserCollection,
  batchUpsert,
  deleteDocumentChunks,
  type VectorPoint,
} from '../lib/qdrant.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

// 测试用户
const userId = 'eac2b544-7f81-4620-a30e-c1e3b70e53e6'
const kbId = 'fbe514e4-09cf-4012-aafa-9f2374eb74d7'

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                   Qdrant Worker 测试                              ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  const testContent = `
# Context OS 技术架构

## 核心组件

Context OS 是一个智能文档处理系统，基于 Dify Parent-child-HQ 工作流设计。

### 支持的格式
- PDF: 使用 unpdf 库解析
- DOCX: 使用 mammoth 库解析
- TXT/MD: 直接读取文本内容

### 分块策略
- 父块大小: 1024 tokens
- 子块大小: 256 tokens

### K-Type 认知分析
使用 SiliconFlow DeepSeek-V3 Pro 模型进行快速认知分析。
`.trim()

  console.log(`\n📄 测试内容长度: ${testContent.length} 字符`)

  // 1. 确保用户 collection 存在
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('1. 准备 Qdrant Collection')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const collectionName = await ensureUserCollection(userId)
  console.log(`✅ Collection: ${collectionName}`)

  // 2. 分块
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('2. 父子分块')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const { parentChunks, childChunks } = await splitIntoParentChildChunksBatch(testContent, {
    parentChunkSize: 1024,
    childChunkSize: 256,
    removeExtraSpaces: true,
  })

  console.log(`✅ 父块: ${parentChunks.length}, 子块: ${childChunks.length}`)

  // 3. K-Type 分析 (简化版跳过，直接使用模拟数据)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('3. K-Type 分析 (跳过，使用模拟数据)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 4. 准备 Qdrant 向量点
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('4. 生成向量嵌入')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  let qdrantId = 1
  const qdrantPoints: VectorPoint[] = []
  const parentIdMap = new Map<number, number>()

  // 父块
  for (const parent of parentChunks) {
    qdrantPoints.push({
      id: qdrantId,
      vector: [], // 稍后填充
      payload: {
        doc_id: 'test-doc-001',
        kb_id: kbId,
        user_id: userId,
        type: 'parent',
        content: parent.content,
        chunk_index: parent.index,
        metadata: { file_name: 'test.txt' },
      },
    })
    parentIdMap.set(parent.index, qdrantId)
    qdrantId++
  }

  // 子块
  for (const child of childChunks) {
    const parentQdrantId = parentIdMap.get(child.parentIndex)
    qdrantPoints.push({
      id: qdrantId,
      vector: [], // 稍后填充
      payload: {
        doc_id: 'test-doc-001',
        kb_id: kbId,
        user_id: userId,
        type: 'child',
        parent_id: parentQdrantId,
        content: child.content,
        chunk_index: child.index,
        metadata: { file_name: 'test.txt', parent_index: child.parentIndex },
      },
    })
    qdrantId++
  }

  console.log(`✅ 准备了 ${qdrantPoints.length} 个向量点`)

  // 5. 批量生成 embedding
  const embeddingModel = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3'
  const batchSize = 50

  const allTexts = qdrantPoints.map(p => p.payload.content)
  const allEmbeddings: number[][] = []

  console.log(`🔄 生成 embedding (模型: ${embeddingModel})...`)

  for (let i = 0; i < allTexts.length; i += batchSize) {
    const batch = allTexts.slice(i, i + batchSize)
    const embeddingResponse = await embeddingClient.embeddings.create({
      model: embeddingModel,
      input: batch,
    })
    allEmbeddings.push(...embeddingResponse.data.map(d => d.embedding))
    console.log(`   批次 ${Math.floor(i / batchSize) + 1}: ${embeddingResponse.data.length} 个向量`)
  }

  // 填充向量
  qdrantPoints.forEach((point, i) => {
    point.vector = allEmbeddings[i]
  })

  // 6. 插入 Qdrant
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('5. 写入 Qdrant')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await batchUpsert(userId, qdrantPoints, batchSize)
  console.log(`✅ 成功插入 ${qdrantPoints.length} 个向量点`)

  // 7. 验证搜索
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('6. 验证搜索')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const { searchInKb } = await import('../lib/qdrant.js')
  const queryVector = allEmbeddings[0] // 用第一个向量作为查询
  const results = await searchInKb(userId, kbId, queryVector, { limit: 5 })

  console.log(`✅ 搜索到 ${results.length} 个结果:`)
  results.slice(0, 3).forEach((r, i) => {
    console.log(`   [${i + 1}] Score: ${r.score.toFixed(4)} | ${r.payload.content.substring(0, 50)}...`)
  })

  // 8. 清理测试数据
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('7. 清理测试数据')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await deleteDocumentChunks(userId, 'test-doc-001')
  console.log('✅ 测试数据已清理')

  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                    ✅ 测试成功!                                  ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
}

main().catch((error) => {
  console.error('\n❌ 测试失败:', error.message)
  process.exit(1)
})
