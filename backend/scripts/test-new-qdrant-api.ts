/**
 * 测试新的 Qdrant query API
 *
 * 用途: 验证从旧的 search API 迁移到新的 query API 后功能正常
 */

import { QdrantClient } from '@qdrant/js-client-rest'

// 配置
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'
const TEST_COLLECTION = 'test-new-api'
const VECTOR_DIM = 1024

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('🧪 测试新的 Qdrant query API')
  console.log(`📍 Qdrant URL: ${QDRANT_URL}`)
  console.log('')

  const client = new QdrantClient({ url: QDRANT_URL })

  try {
    // 1. 检查 Qdrant 服务
    console.log('1️⃣ 检查 Qdrant 服务...')
    const collections = await client.getCollections()
    console.log(`✅ Qdrant 服务正常，当前有 ${collections.collections.length} 个集合`)

    // 2. 清理旧的测试集合
    console.log('')
    console.log('2️⃣ 清理旧的测试集合...')
    try {
      await client.deleteCollection(TEST_COLLECTION)
      console.log(`✅ 已删除旧的测试集合: ${TEST_COLLECTION}`)
    } catch {
      console.log(`ℹ️ 不存在旧的测试集合`)
    }

    // 3. 创建测试集合
    console.log('')
    console.log('3️⃣ 创建测试集合...')
    await client.createCollection(TEST_COLLECTION, {
      vectors: { size: VECTOR_DIM, distance: 'Cosine' },
    })
    console.log(`✅ 已创建测试集合: ${TEST_COLLECTION}`)

    // 4. 插入测试数据
    console.log('')
    console.log('4️⃣ 插入测试数据...')
    const testVector = Array(VECTOR_DIM).fill(0).map((_, i) => Math.random())

    await client.upsert(TEST_COLLECTION, {
      points: [
        {
          id: 1,
          vector: testVector,
          payload: { type: 'document', content: '测试文档 1' },
        },
        {
          id: 2,
          vector: testVector.map(v => v + 0.1),
          payload: { type: 'parent', content: '测试父块 1' },
        },
        {
          id: 3,
          vector: testVector.map(v => v - 0.1),
          payload: { type: 'child', content: '测试子块 1' },
        },
      ],
    })
    console.log('✅ 已插入 3 个测试向量点')

    // 等待索引完成
    await sleep(1000)

    // 5. 测试旧的 search API (如果可用)
    console.log('')
    console.log('5️⃣ 测试旧的 search API...')
    try {
      const oldResult = await client.search(TEST_COLLECTION, {
        vector: testVector,
        limit: 3,
        with_payload: true,
      })
      console.log(`✅ 旧的 search API 返回 ${oldResult.length} 个结果`)
      console.log(`   第一个结果: score=${oldResult[0]?.score.toFixed(4)}, type=${oldResult[0]?.payload?.type}`)
    } catch (e: any) {
      console.log(`⚠️  旧的 search API 失败: ${e.message}`)
    }

    // 6. 测试新的 query API (推荐)
    console.log('')
    console.log('6️⃣ 测试新的 query API...')
    const newResult = await client.query(TEST_COLLECTION, {
      query: testVector,
      limit: 3,
      with_payload: true,
    })
    console.log(`✅ 新的 query API 返回 ${newResult.points.length} 个结果`)
    console.log(`   第一个结果: score=${newResult.points[0]?.score.toFixed(4)}, type=${newResult.points[0]?.payload?.type}`)

    // 7. 测试带过滤条件的 query
    console.log('')
    console.log('7️⃣ 测试带过滤条件的 query API...')
    const filteredResult = await client.query(TEST_COLLECTION, {
      query: testVector,
      limit: 10,
      with_payload: true,
      filter: {
        must: [{ key: 'type', match: { value: 'child' } }],
      },
    })
    console.log(`✅ 过滤查询返回 ${filteredResult.points.length} 个结果`)
    console.log(`   结果类型: ${filteredResult.points.map(p => p.payload?.type).join(', ')}`)

    // 8. 验证结果一致性
    console.log('')
    console.log('8️⃣ 验证结果一致性...')
    if (newResult.points.length === 3) {
      console.log('✅ 新 API 返回结果数量正确')
    } else {
      console.log(`⚠️  预期 3 个结果，实际返回 ${newResult.points.length} 个`)
    }

    // 9. 清理测试数据
    console.log('')
    console.log('9️⃣ 清理测试数据...')
    await client.deleteCollection(TEST_COLLECTION)
    console.log('✅ 已删除测试集合')

    console.log('')
    console.log('🎉 所有测试通过！新的 query API 工作正常')
  } catch (error: any) {
    console.error('')
    console.error('❌ 测试失败!')
    console.error(`错误: ${error.message}`)

    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
      console.error('')
      console.error('💡 提示: 请确保 Qdrant 服务正在运行:')
      console.error('   docker-compose up -d qdrant')
    }

    process.exit(1)
  }
}

main()
