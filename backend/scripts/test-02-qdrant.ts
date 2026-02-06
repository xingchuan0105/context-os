/**
 * 测试 Qdrant 向量数据库连接
 * 验证集合创建、向量点插入、搜索等功能
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import qdrantModule from '../lib/qdrant'
import { v4 as uuidv4 } from 'uuid'

// 加载环境变量
const envPath = resolve(process.cwd(), '.env')
config({ path: envPath })

async function testQdrantConnection() {
  console.log('='.repeat(70))
  console.log('🔍 测试 Qdrant 向量数据库连接')
  console.log('='.repeat(70))
  console.log()

  const {
    VECTOR_DIM,
    getUserClient,
    ensureUserCollection,
    upsertPoints,
    healthCheck,
    listCollections,
  } = qdrantModule

  try {
    // ==================== 测试 1: 健康检查 ====================
    console.log('🏥 测试 1: Qdrant 服务健康检查...')

    const isHealthy = await healthCheck()
    if (!isHealthy) {
      throw new Error('Qdrant 服务未响应')
    }
    console.log('✅ Qdrant 服务运行正常')
    console.log()

    // ==================== 测试 2: 获取集合列表 ====================
    console.log('📋 测试 2: 获取现有集合列表...')

    const collections = await listCollections()
    console.log(`✅ 现有集合数: ${collections.length}`)

    if (collections.length > 0) {
      console.log('  现有集合:')
      collections.forEach((name: string) => {
        console.log(`    - ${name}`)
      })
    }
    console.log()

    // ==================== 测试 3: 创建测试用户集合 ====================
    console.log('📦 测试 3: 创建测试用户集合...')

    const testUserId = 'test-user-qdrant-client'
    const client = getUserClient(testUserId)

    try {
      await ensureUserCollection(testUserId)
      console.log(`✅ 测试用户集合已就绪`)
    } catch (error: any) {
      console.log(`ℹ️  集合创建信息: ${error.message}`)
    }
    console.log()

    // ==================== 测试 4: 准备测试数据 ====================
    console.log('➕ 测试 4: 准备测试向量点...')

    const testPoints = [
      {
        id: uuidv4(),
        vector: Array(VECTOR_DIM).fill(0).map((_, i) => Math.sin(i * 0.1)),
        payload: {
          doc_id: 'test-doc-1',
          kb_id: 'test-kb-1',
          user_id: testUserId,
          type: 'document',
          content: '这是测试文档摘要',
          chunk_index: 0,
          metadata: {
            file_name: 'test.txt',
            test: true,
          },
        },
      },
      {
        id: uuidv4(),
        vector: Array(VECTOR_DIM).fill(0).map((_, i) => Math.cos(i * 0.1)),
        payload: {
          doc_id: 'test-doc-1',
          kb_id: 'test-kb-1',
          user_id: testUserId,
          type: 'parent',
          content: '这是父块内容，包含更多的上下文信息。',
          chunk_index: 0,
          metadata: {
            file_name: 'test.txt',
            test: true,
          },
        },
      },
      {
        id: uuidv4(),
        vector: Array(VECTOR_DIM).fill(0).map((_, i) => Math.sin(i * 0.2)),
        payload: {
          doc_id: 'test-doc-1',
          kb_id: 'test-kb-1',
          user_id: testUserId,
          type: 'child',
          parent_id: `parent_test-doc-1_0`,
          content: '这是子块内容，更细粒度的信息。',
          chunk_index: 0,
          metadata: {
            file_name: 'test.txt',
            parent_index: 0,
            test: true,
          },
        },
      },
    ]

    console.log(`   已准备 ${testPoints.length} 个测试向量点`)
    console.log(`   向量维度: ${VECTOR_DIM}`)
    console.log()

    // ==================== 测试 5: 插入向量点 ====================
    console.log('💾 测试 5: 插入向量点到 Qdrant...')

    const upsertResult = await upsertPoints(testUserId, testPoints)
    console.log(`✅ 成功插入 ${testPoints.length} 个向量点`)
    console.log(`   - 文档层: 1 个`)
    console.log(`   - 父块层: 1 个`)
    console.log(`   - 子块层: 1 个`)
    console.log()

    // ==================== 测试 6: 验证插入结果 ====================
    console.log('🔍 测试 6: 验证插入结果...')

    const collectionInfo = await client.getCollection(`user_${testUserId}_vectors`)
    console.log(`✅ 集合信息:`)
    console.log(`   - 向量点总数: ${collectionInfo.result.points_count}`)
    console.log(`   - 向量维度: ${collectionInfo.result.config.params.vectors.size}`)
    console.log(`   - 距离度量: ${collectionInfo.result.config.params.vectors.distance}`)
    console.log()

    // ==================== 测试 7: 搜索测试 ====================
    console.log('🔎 测试 7: 向量搜索测试...')

    const searchResult = await client.search(`user_${testUserId}_vectors`, {
      vector: Array(VECTOR_DIM).fill(0).map((_, i) => Math.sin(i * 0.1)),
      limit: 3,
      with_payload: true,
    })

    console.log(`✅ 搜索完成，找到 ${searchResult.length} 个结果:`)
    searchResult.forEach((result: any, index: number) => {
      const payload = result.payload as any
      console.log(`   ${index + 1}. [${payload.type}] ${payload.content.substring(0, 30)}...`)
      console.log(`      分数: ${result.score.toFixed(4)}`)
    })
    console.log()

    // ==================== 总结 ====================
    console.log('='.repeat(70))
    console.log('✅ Qdrant 连接测试全部通过！')
    console.log('='.repeat(70))
    console.log()
    console.log('📋 测试结果总结:')
    console.log('   ✅ 服务连接正常')
    console.log('   ✅ 集合管理正常')
    console.log('   ✅ 向量点插入成功')
    console.log('   ✅ 向量搜索功能正常')
    console.log()
    console.log('🎯 Qdrant 已准备就绪，可以用于 RAG 系统！')
    console.log()
    console.log('💡 提示: 测试数据已保留，可以手动清理:')
    console.log(`   curl -X DELETE http://localhost:6333/collections/user_${testUserId}_vectors`)

  } catch (error: any) {
    console.error()
    console.error('❌ Qdrant 测试失败！')
    console.error(`   错误: ${error.message}`)
    if (error.stack) {
      console.error(`   堆栈: ${error.stack}`)
    }
    process.exit(1)
  }
}

testQdrantConnection()
