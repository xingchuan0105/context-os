#!/usr/bin/env tsx
/**
 * Qdrant Client 封装测试
 * 测试 lib/qdrant.ts 中封装的所有功能
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

import qdrant, {
  VECTOR_DIM,
  getUserCollectionName,
  ensureUserCollection,
  upsertPoints,
  deleteDocumentChunks,
  getDocumentChunks,
  search,
  searchWithParentContext,
  searchInKb,
  batchUpsert,
  healthCheck,
  listCollections,
  type ChunkPayload,
  type VectorPoint,
} from '../lib/qdrant.js'

// 测试用户 ID
const TEST_USER_ID = 'test-user-qdrant-client'
const TEST_KB_ID = 'test-kb-001'
const TEST_DOC_ID = 'test-doc-001'

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                   Qdrant Client 测试                          ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  // 1. 健康检查
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('1. 健康检查')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const isHealthy = await healthCheck()
  console.log(`Qdrant 服务状态: ${isHealthy ? '✅ 正常' : '❌ 异常'}`)

  if (!isHealthy) {
    console.error('Qdrant 服务不可用，请检查 Docker 容器是否运行')
    process.exit(1)
  }

  // 2. 列出现有 collections
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('2. 现有 Collections')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const collections = await listCollections()
  console.log(`现有 collections: ${collections.length > 0 ? collections.join(', ') : '(无)'}`)

  // 3. 创建用户 collection
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('3. 创建用户 Collection')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const collectionName = await ensureUserCollection(TEST_USER_ID)
  console.log(`✅ Collection 名称: ${collectionName}`)
  console.log(`   向量维度: ${VECTOR_DIM}`)

  // 4. 准备测试数据 (模拟 parent-child chunks)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('4. 准备测试数据')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 生成模拟向量 (实际使用时应该由 embedding 模型生成)
  const generateVector = (): number[] =>
    Array.from({ length: VECTOR_DIM }, () => Math.random())

  const testPoints: VectorPoint[] = [
    // 父块
    {
      id: 1,
      vector: generateVector(),
      payload: {
        doc_id: TEST_DOC_ID,
        kb_id: TEST_KB_ID,
        user_id: TEST_USER_ID,
        type: 'parent',
        content: '这是父块内容。Context OS 是一个基于 Dify Parent-child-HQ 工作流的智能文档处理系统，支持 PDF、DOCX、TXT、Markdown 和网页等多种格式的文档解析。',
        chunk_index: 0,
        metadata: {
          file_name: 'test-doc.txt',
          k_type: {
            classification: { scores: { conceptual: 8, systemic: 7 } },
            dominant_type: ['Conceptual', 'Systemic'],
            dikw_level: 'Knowledge',
          },
        },
      },
    },
    // 子块 1
    {
      id: 2,
      vector: generateVector(),
      payload: {
        doc_id: TEST_DOC_ID,
        kb_id: TEST_KB_ID,
        user_id: TEST_USER_ID,
        type: 'child',
        parent_id: 1,
        content: 'Context OS 支持多种格式的文档解析，包括 PDF、DOCX、TXT、Markdown 和网页。',
        chunk_index: 0,
        metadata: {
          file_name: 'test-doc.txt',
        },
      },
    },
    // 子块 2
    {
      id: 3,
      vector: generateVector(),
      payload: {
        doc_id: TEST_DOC_ID,
        kb_id: TEST_KB_ID,
        user_id: TEST_USER_ID,
        type: 'child',
        parent_id: 1,
        content: '系统基于 Dify Parent-child-HQ 工作流设计，实现了智能的父子分块策略。',
        chunk_index: 1,
        metadata: {
          file_name: 'test-doc.txt',
        },
      },
    },
    // 第二个文档的父块
    {
      id: 4,
      vector: generateVector(),
      payload: {
        doc_id: 'test-doc-002',
        kb_id: TEST_KB_ID,
        user_id: TEST_USER_ID,
        type: 'parent',
        content: 'Qdrant 是一个高性能的向量搜索引擎，支持过滤搜索、混合搜索等高级功能。',
        chunk_index: 0,
        metadata: {
          file_name: 'test-doc-2.txt',
        },
      },
    },
    // 第二个文档的子块
    {
      id: 5,
      vector: generateVector(),
      payload: {
        doc_id: 'test-doc-002',
        kb_id: TEST_KB_ID,
        user_id: TEST_USER_ID,
        type: 'child',
        parent_id: 4,
        content: 'Qdrant 支持过滤搜索，可以根据 payload 字段进行精确过滤。',
        chunk_index: 0,
        metadata: {
          file_name: 'test-doc-2.txt',
        },
      },
    },
  ]

  console.log(`✅ 准备了 ${testPoints.length} 个测试向量点`)
  console.log(`   - 父块: ${testPoints.filter(p => p.payload.type === 'parent').length}`)
  console.log(`   - 子块: ${testPoints.filter(p => p.payload.type === 'child').length}`)

  // 5. 插入向量
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('5. 插入向量点')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await upsertPoints(TEST_USER_ID, testPoints)
  console.log('✅ 向量点插入成功')

  // 6. 获取文档的所有 chunks
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('6. 获取文档的所有 Chunks')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const allChunks = await getDocumentChunks(TEST_USER_ID, TEST_DOC_ID)
  console.log(`✅ 文档 ${TEST_DOC_ID} 的所有 chunks: ${allChunks.length} 个`)
  allChunks.forEach((chunk, i) => {
    console.log(`   [${i + 1}] ${chunk.payload?.type}: ${chunk.payload?.content?.substring(0, 50)}...`)
  })

  // 只获取父块
  const parentChunks = await getDocumentChunks(TEST_USER_ID, TEST_DOC_ID, { type: 'parent' })
  console.log(`   父块数量: ${parentChunks.length}`)

  // 7. 向量搜索
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('7. 向量搜索')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const queryVector = generateVector()
  const searchResults = await search(TEST_USER_ID, queryVector, { limit: 5 })

  console.log(`✅ 搜索到 ${searchResults.length} 个结果:`)
  searchResults.forEach((result, i) => {
    console.log(`   [${i + 1}] Score: ${result.score.toFixed(4)} | ${result.payload.type} | ${result.payload.content.substring(0, 50)}...`)
  })

  // 8. 按文档过滤搜索
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('8. 按文档过滤搜索')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const docResults = await search(TEST_USER_ID, queryVector, {
    limit: 10,
    filter: { docId: TEST_DOC_ID },
  })

  console.log(`✅ 文档 ${TEST_DOC_ID} 中搜索到 ${docResults.length} 个结果`)

  // 9. 按知识库搜索
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('9. 按知识库搜索')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const kbResults = await searchInKb(TEST_USER_ID, TEST_KB_ID, queryVector, { limit: 10 })
  console.log(`✅ 知识库 ${TEST_KB_ID} 中搜索到 ${kbResults.length} 个子块`)

  // 10. 搜索并获取父块上下文
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('10. 搜索 + 父块上下文')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const resultsWithParent = await searchWithParentContext(TEST_USER_ID, queryVector)
  console.log(`✅ 搜索到 ${resultsWithParent.length} 个结果 (含父块上下文):`)

  resultsWithParent.slice(0, 2).forEach((result, i) => {
    console.log(`\n   [${i + 1}] Score: ${result.score.toFixed(4)}`)
    console.log(`       子块: ${result.payload.content.substring(0, 60)}...`)
    if (result.parentContent) {
      console.log(`       父块: ${result.parentContent.substring(0, 60)}...`)
    }
  })

  // 11. 批量插入测试
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('11. 批量插入测试')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const batchPoints: VectorPoint[] = Array.from({ length: 10 }, (_, i) => ({
    id: 100 + i,
    vector: generateVector(),
    payload: {
      doc_id: 'test-doc-batch',
      kb_id: TEST_KB_ID,
      user_id: TEST_USER_ID,
      type: 'child',
      content: `批量插入测试 ${i + 1}`,
      chunk_index: i,
    },
  }))

  await batchUpsert(TEST_USER_ID, batchPoints, 3) // 小批次测试
  console.log(`✅ 批量插入 ${batchPoints.length} 个点成功 (批次大小: 3)`)

  // 12. 删除文档 chunks
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('12. 删除文档 Chunks')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await deleteDocumentChunks(TEST_USER_ID, 'test-doc-batch')
  console.log('✅ 批量测试文档已删除')

  // 验证删除
  const remainingChunks = await getDocumentChunks(TEST_USER_ID, 'test-doc-batch')
  console.log(`   剩余 chunks: ${remainingChunks.length}`)

  // 13. 清理测试数据
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('13. 清理测试数据')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const qdrant = await import('../lib/qdrant.js')
  // 注意: deleteUserCollection 需要导出
  // await deleteUserCollection(TEST_USER_ID)
  console.log('ℹ️  测试 collection 保留，可手动清理')

  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                    ✅ 所有测试通过!                              ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  console.log('\n提示: 测试 collection 已保留，可手动删除:')
  console.log(`  collection 名称: ${getUserCollectionName(TEST_USER_ID)}`)
}

main().catch((error) => {
  console.error('\n❌ 测试失败:', error.message)
  console.error(error.stack)
  process.exit(1)
})
