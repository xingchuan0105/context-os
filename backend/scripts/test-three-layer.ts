#!/usr/bin/env tsx
/**
 * 三层检索测试脚本
 *
 * 测试内容:
 * 1. 创建测试文档的三层向量点
 * 2. 执行三层钻取检索
 * 3. 验证返回结果的结构
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

import { createClient } from '@supabase/supabase-js'
import embeddingClient from '../lib/embedding.js'
import {
  ensureUserCollection,
  batchUpsert,
  deleteDocumentChunks,
  searchWithDrillDown,
  searchWithDrillDownRelaxed,
  getDocumentLayers,
  type VectorPoint,
} from '../lib/qdrant.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 测试用户和文档
const userId = 'eac2b544-7f81-4620-a30e-c1e3b70e53e6'
const testDocId = 'test-three-layer-doc-001'

/**
 * 生成测试数据
 */
function generateTestData() {
  // K-Type 摘要 (文档层)
  const ktypeSummary = `【文档类型】
本文档以 Procedure(操作步骤)为主导。
类型分布: Procedure(操作步骤): 75%, Theory(概念原理): 15%, System(系统架构): 10%。

【核心内容】
1. API 密钥的创建和管理流程
2. 不同权限级别的配置方法
3. 常见错误排查步骤

【认知特征】
DIKW层级: Knowledge(知识)。
逻辑模式: 线性流程。

【内容概要】
本文档是 API 管理的操作指南，详细介绍了如何创建、管理和使用 API 密钥。`

  // 父块 (章节层)
  const parentChunks = [
    {
      index: 0,
      content: `## API 密钥管理概述

API 密钥是访问本服务的主要认证方式。每个账户最多可以创建 5 个密钥，密钥创建后只显示一次，请妥善保管。密钥具有不同的权限级别，包括只读、读写和管理员权限。`,
    },
    {
      index: 1,
      content: `## 创建 API 密钥

创建 API 密钥需要在控制台操作。登录后进入"API管理"页面，点击"新建密钥"按钮。系统会生成一个以 sk- 开头的密钥字符串。请立即复制保存，因为关闭窗口后无法再次查看完整密钥。`,
    },
    {
      index: 2,
      content: `## 密钥权限配置

密钥权限分为三级：只读权限只能查询数据，不能修改；读写权限可以查询和修改数据；管理员权限拥有所有操作权限。创建密钥时需要根据使用场景选择合适的权限级别。`,
    },
  ]

  // 子块 (细节层)
  const childChunks = [
    { parentIndex: 0, index: 0, content: 'API 密钥是访问本服务的主要认证方式。' },
    { parentIndex: 0, index: 1, content: '每个账户最多可以创建 5 个密钥。' },
    { parentIndex: 0, index: 2, content: '密钥创建后只显示一次，请妥善保管。' },
    { parentIndex: 1, index: 0, content: '创建 API 密钥需要在控制台操作。' },
    { parentIndex: 1, index: 1, content: '登录后进入"API管理"页面，点击"新建密钥"按钮。' },
    { parentIndex: 1, index: 2, content: '系统会生成一个以 sk- 开头的密钥字符串。' },
    { parentIndex: 1, index: 3, content: '请立即复制保存，因为关闭窗口后无法再次查看完整密钥。' },
    { parentIndex: 2, index: 0, content: '密钥权限分为三级：只读、读写和管理员权限。' },
    { parentIndex: 2, index: 1, content: '只读权限只能查询数据，不能修改。' },
    { parentIndex: 2, index: 2, content: '读写权限可以查询和修改数据。' },
    { parentIndex: 2, index: 3, content: '管理员权限拥有所有操作权限。' },
  ]

  return { ktypeSummary, parentChunks, childChunks }
}

/**
 * ID 生成器
 */
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

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                    三层检索测试                                  ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  // 1. 准备测试数据
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('1. 准备测试数据')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const { ktypeSummary, parentChunks, childChunks } = generateTestData()
  console.log(`✅ K-Type 摘要: ${ktypeSummary.length} 字符`)
  console.log(`✅ 父块: ${parentChunks.length} 个`)
  console.log(`✅ 子块: ${childChunks.length} 个`)

  // 2. 确保 Qdrant collection 存在
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('2. 准备 Qdrant Collection')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const collectionName = await ensureUserCollection(userId)
  console.log(`✅ Collection: ${collectionName}`)

  // 3. 清理旧测试数据
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('3. 清理旧测试数据')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await deleteDocumentChunks(userId, testDocId)
  console.log('✅ 旧数据已清理')

  // 4. 生成向量
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('4. 生成向量嵌入')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const textsToEmbed = [
    ktypeSummary,
    ...parentChunks.map(p => p.content),
    ...childChunks.map(c => c.content),
  ]

  const embeddingModel = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3'
  const allEmbeddings: number[][] = []

  for (let i = 0; i < textsToEmbed.length; i += 50) {
    const batch = textsToEmbed.slice(i, i + 50)
    const embeddingResponse = await embeddingClient.embeddings.create({
      model: embeddingModel,
      input: batch,
    })
    allEmbeddings.push(...embeddingResponse.data.map(d => d.embedding))
  }

  console.log(`✅ 生成了 ${allEmbeddings.length} 个向量 (模型: ${embeddingModel})`)

  // 5. 准备向量点
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('5. 准备向量点')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const docIndex = Date.now() % 10000
  const idGen = new QdrantIdGenerator(docIndex)
  const points: VectorPoint[] = []
  let embedIndex = 0

  // Document
  points.push({
    id: idGen.getDocumentId(),
    vector: allEmbeddings[embedIndex++],
    payload: {
      doc_id: testDocId,
      kb_id: 'test-kb',
      user_id: userId,
      type: 'document',
      content: ktypeSummary,
      chunk_index: 0,
      metadata: {
        ktype: {
          dominant_type: 'procedural',
          knowledge_modules: ['API密钥管理', '权限配置'],
        },
      },
    },
  })

  // Parents
  for (const parent of parentChunks) {
    points.push({
      id: idGen.getParentId(parent.index),
      vector: allEmbeddings[embedIndex++],
      payload: {
        doc_id: testDocId,
        kb_id: 'test-kb',
        user_id: userId,
        type: 'parent',
        content: parent.content,
        chunk_index: parent.index,
        metadata: {},
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
        doc_id: testDocId,
        kb_id: 'test-kb',
        user_id: userId,
        type: 'child',
        parent_id: parentQdrantId,
        content: child.content,
        chunk_index: child.index,
        metadata: { parent_index: child.parentIndex },
      },
    })
  }

  console.log(`✅ 准备了 ${points.length} 个向量点`)
  console.log(`   - Document: 1 (ID: ${idGen.getDocumentId()})`)
  console.log(`   - Parents: ${parentChunks.length} (ID: ${idGen.getParentId(0)} ~ ${idGen.getParentId(parentChunks.length - 1)})`)
  console.log(`   - Children: ${childChunks.length} (ID: ${idGen.getChildId(0, 0)} ~ ${idGen.getChildId(childChunks[childChunks.length - 1].parentIndex, childChunks[childChunks.length - 1].index)})`)

  // 6. 写入 Qdrant
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('6. 写入 Qdrant')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await batchUpsert(userId, points, 100)
  console.log(`✅ 成功插入 ${points.length} 个向量点`)

  // 7. 测试三层检索
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('7. 测试三层钻取检索')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const testQueries = [
    '如何创建 API 密钥？',
    'API 密钥有什么权限级别？',
    '怎么管理 API 密钥？',
  ]

  for (const query of testQueries) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`查询: "${query}"`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // 生成查询向量
    const queryEmbedding = await embeddingClient.embeddings.create({
      model: embeddingModel,
      input: query,
    })
    const queryVector = queryEmbedding.data[0].embedding

    // 三层检索
    const result = await searchWithDrillDown(userId, queryVector, {
      filter: { kbId: 'test-kb' },
      childLimit: 3,
    })

    console.log(`\n【文档层】`)
    if (result.document) {
      console.log(`   Score: ${result.document.score.toFixed(4)}`)
      console.log(`   摘要: ${result.document.payload.content.substring(0, 100)}...`)
    } else {
      console.log(`   (未找到)`)
    }

    console.log(`\n【父块层】`)
    if (result.parent) {
      console.log(`   Score: ${result.parent.score.toFixed(4)}`)
      console.log(`   内容: ${result.parent.payload.content.substring(0, 80)}...`)
    } else {
      console.log(`   (未找到)`)
    }

    console.log(`\n【子块层】`)
    if (result.children.length > 0) {
      result.children.forEach((child, i) => {
        console.log(`   [${i + 1}] Score: ${child.score.toFixed(4)} | ${child.payload.content.substring(0, 50)}...`)
      })
    } else {
      console.log(`   (未找到)`)
    }
  }

  // 8. 测试宽松模式
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('8. 测试宽松检索模式')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const queryEmbedding = await embeddingClient.embeddings.create({
    model: embeddingModel,
    input: '权限',
  })
  const queryVector = queryEmbedding.data[0].embedding

  const relaxedResult = await searchWithDrillDownRelaxed(userId, queryVector, {
    filter: { kbId: 'test-kb' },
    childLimit: 5,
  })

  console.log(`\n文档层: ${relaxedResult.document ? '✓' : '✗'}`)
  console.log(`父块层: ${relaxedResult.parent ? '✓' : '✗'}`)
  console.log(`子块层: ${relaxedResult.children.length} 个结果`)

  // 9. 获取文档所有层级
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('9. 获取文档所有层级')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const layers = await getDocumentLayers(userId, testDocId)
  console.log(`Document: ${layers.document ? '1 个' : '0 个'}`)
  console.log(`Parents: ${layers.parents.length} 个`)
  console.log(`Children: ${layers.children.length} 个`)

  // 10. 清理
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('10. 清理测试数据')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await deleteDocumentChunks(userId, testDocId)
  console.log('✅ 测试数据已清理')

  console.log('\n��═══════════════════════════════════════════════════════════════╗')
  console.log('║                    ✅ 测试完成!                                  ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
}

main().catch((error) => {
  console.error('\n❌ 测试失败:', error.message)
  process.exit(1)
})
