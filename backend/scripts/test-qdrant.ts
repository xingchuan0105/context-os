#!/usr/bin/env tsx
/**
 * Qdrant 基本功能测试
 * 测试: 连接、创建集合、插入向量、搜索、删除
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

import { QdrantClient } from '@qdrant/js-client-rest'

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'

// 测试用向量维度 (bge-m3 使用 1024 维)
const VECTOR_DIM = 1024

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                     Qdrant 功能测试                              ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log(`\n🔗 Qdrant URL: ${QDRANT_URL}`)

  const qdrant = new QdrantClient({ url: QDRANT_URL })

  // 测试集合名称
  const collectionName = 'test_collection'

  try {
    // 1. 清理旧测试数据
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('1. 清理旧测试数据')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    await qdrant.deleteCollection(collectionName).catch(() => {})
    console.log('✅ 旧测试数据已清理')

    // 2. 创建集合
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('2. 创建测试集合')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    await qdrant.createCollection(collectionName, {
      vectors: {
        size: VECTOR_DIM,
        distance: 'Cosine',
      },
      payload_schema: {
        doc_id: 'keyword',
        user_id: 'keyword',
        kb_id: 'keyword',
        type: 'keyword',
        content: 'text',
      },
    })

    const collectionInfo = await qdrant.getCollection(collectionName)
    console.log(`✅ 集合 "${collectionName}" 创建成功`)
    console.log(`   - 向量维度: ${collectionInfo.vectors_count} (配置: ${collectionInfo.config.params.vectors.size})`)
    console.log(`   - 距离度量: ${collectionInfo.config.params.vectors.distance}`)

    // 3. 生成测试向量
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('3. 生成测试向量')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // 模拟父块和子块
    const testPoints = [
      {
        id: 1,
        vector: Array.from({ length: VECTOR_DIM }, () => Math.random()),
        payload: {
          doc_id: 'doc-001',
          user_id: 'user-test-001',
          kb_id: 'kb-test-001',
          type: 'parent',
          content: '这是父块内容，包含更完整的上下文信息。',
          chunk_index: 0,
        },
      },
      {
        id: 2,
        vector: Array.from({ length: VECTOR_DIM }, () => Math.random()),
        payload: {
          doc_id: 'doc-001',
          user_id: 'user-test-001',
          kb_id: 'kb-test-001',
          type: 'child',
          parent_id: 1,
          content: '这是子块内容，更专注于具体细节。',
          chunk_index: 0,
        },
      },
      {
        id: 3,
        vector: Array.from({ length: VECTOR_DIM }, () => Math.random()),
        payload: {
          doc_id: 'doc-001',
          user_id: 'user-test-001',
          kb_id: 'kb-test-001',
          type: 'child',
          parent_id: 1,
          content: '这是第二个子块，包含更多细节信息。',
          chunk_index: 1,
        },
      },
    ]

    console.log(`✅ 生成了 ${testPoints.length} 个测试向量点`)

    // 4. 插入向量
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('4. 插入向量点')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const upsertResult = await qdrant.upsert(collectionName, {
      points: testPoints,
    })

    console.log(`✅ 插入结果: ${upsertResult.status?.type || 'success'}`)

    // 5. 查询集合信息
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('5. 查询集合信息')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const info = await qdrant.getCollection(collectionName)
    console.log(`✅ 集合信息:`)
    console.log(`   - 总点数: ${info.points_count || info.vectors_count}`)
    console.log(`   - 已索引向量: ${info.indexed_vector_count || 0}`)

    // 6. 向量搜索
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('6. 向量搜索测试')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const searchResult = await qdrant.search(collectionName, {
      vector: Array.from({ length: VECTOR_DIM }, () => Math.random()),
      limit: 3,
      with_payload: true,
    })

    console.log(`✅ 搜索到 ${searchResult.length} 个结果:`)
    searchResult.forEach((result, i) => {
      console.log(`   [${i + 1}] Score: ${result.score?.toFixed(4)}`)
      console.log(`       Type: ${result.payload?.type}`)
      console.log(`       Content: ${result.payload?.content?.substring(0, 50)}...`)
    })

    // 7. 过滤搜索
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('7. 过滤搜索测试 (只搜索子块)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const filterResult = await qdrant.search(collectionName, {
      vector: Array.from({ length: VECTOR_DIM }, () => Math.random()),
      limit: 10,
      with_payload: true,
      filter: {
        must: [
          {
            key: 'type',
            match: { value: 'child' },
          },
        ],
      },
    })

    console.log(`✅ 过滤搜索到 ${filterResult.length} 个子块:`)
    filterResult.forEach((result, i) => {
      console.log(`   [${i + 1}] Score: ${result.score?.toFixed(4)} | ${result.payload?.content}`)
    })

    // 8. 按文档过滤
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('8. 按文档过滤搜索')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const docFilterResult = await qdrant.search(collectionName, {
      vector: Array.from({ length: VECTOR_DIM }, () => Math.random()),
      limit: 10,
      with_payload: true,
      filter: {
        must: [
          {
            key: 'doc_id',
            match: { value: 'doc-001' },
          },
        ],
      },
    })

    console.log(`✅ 文档 doc-001 中找到 ${docFilterResult.length} 个块`)

    // 9. 获取指定文档的所有点
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('9. 获取指定文档的所有点')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const scrollResult = await qdrant.scroll(collectionName, {
      limit: 100,
      with_payload: true,
      filter: {
        must: [
          {
            key: 'doc_id',
            match: { value: 'doc-001' },
          },
        ],
      },
    })

    console.log(`✅ 文档 doc-001 共有 ${scrollResult.points.length} 个点`)
    console.log(`   - 父块: ${scrollResult.points.filter(p => p.payload?.type === 'parent').length}`)
    console.log(`   - 子块: ${scrollResult.points.filter(p => p.payload?.type === 'child').length}`)

    // 10. 删除指定文档的点
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('10. 删除指定文档的点')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const deleteResult = await qdrant.delete(collectionName, {
      filter: {
        must: [
          {
            key: 'doc_id',
            match: { value: 'doc-001' },
          },
        ],
      },
    })

    console.log(`✅ 删除结果: ${deleteResult.status?.type || 'success'}`)

    // 11. 验证删除
    const finalInfo = await qdrant.getCollection(collectionName)
    console.log(`✅ 删除后集合点数: ${finalInfo.points_count || finalInfo.vectors_count}`)

    // 12. 清理测试集合
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('11. 清理测试集合')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    await qdrant.deleteCollection(collectionName)
    console.log('✅ 测试集合已删除')

    console.log('\n╔═══════════════════════════════════════════════════════════════╗')
    console.log('║                    ✅ 所有测试通过!                              ║')
    console.log('╚═══════════════════════════════════════════════════════════════╝')

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
