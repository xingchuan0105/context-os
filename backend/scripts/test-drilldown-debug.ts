import { search, searchWithDrillDown } from '../lib/qdrant'
import embeddingClient from '../lib/embedding'

const userId = 'test-user-1768291337020'

async function testBasicSearch() {
  console.log('\n=== 测试基础搜索 ===\n')

  const query = 'Java 设计模式'

  // 生成查询向量
  console.log('1. 生成查询向量...')
  const embeddingResponse = await embeddingClient.embeddings.create({
    model: 'BAAI/bge-m3',
    input: [query],
  })

  const queryVector = embeddingResponse.data[0].embedding
  console.log(`   向量维度: ${queryVector.length}`)

  // 测试基础搜索
  console.log('\n2. 执行基础搜索...')
  const results = await search(userId, queryVector, {
    limit: 3,
    scoreThreshold: 0.5,
  })

  console.log(`   找到 ${results.length} 个结果`)
  results.forEach((r, i) => {
    const payload = r.payload as any
    console.log(`\n   [${i + 1}] Score: ${(r.score * 100).toFixed(1)}%`)
    console.log(`   Type: ${payload?.type}`)
    console.log(`   Content: ${payload?.content?.substring(0, 100)}...`)
  })
}

async function testDrillDownSearch() {
  console.log('\n\n=== 测试三层钻取搜索 ===\n')

  const query = 'Java 设计模式'

  console.log('1. 执行三层钻取搜索...')
  try {
    const results = await searchWithDrillDown(userId, query, {
      l1Limit: 1,
      l2Limit: 3,
      l3Limit: 5,
      scoreThreshold: 0.3,
    })

    console.log(`   L1 层结果: ${results.l1?.length || 0}`)
    console.log(`   L2 层结果: ${results.l2?.length || 0}`)
    console.log(`   L3 层结果: ${results.l3?.length || 0}`)

    if (results.l3 && results.l3.length > 0) {
      console.log('\n   L3 层前 3 个结果:')
      results.l3.slice(0, 3).forEach((r, i) => {
        const payload = r.payload as any
        console.log(`\n   [${i + 1}] Score: ${(r.score * 100).toFixed(1)}%`)
        console.log(`   Type: ${payload?.type}`)
        console.log(`   Content: ${payload?.content?.substring(0, 100)}...`)
      })
    }
  } catch (error) {
    console.error('   ❌ 错误:', (error as Error).message)
    console.error('   Stack:', (error as Error).stack)
  }
}

async function main() {
  try {
    await testBasicSearch()
    await testDrillDownSearch()

    console.log('\n✅ 测试完成\n')
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

main()
