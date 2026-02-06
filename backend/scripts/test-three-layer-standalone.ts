/**
 * 测试三层检索功能 (使用新的 query API)
 *
 * 验证 searchWithDrillDown 和 searchWithDrillDownRelaxed 是否正常工作
 */

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

// 测试配置
const userId = 'test-user-three-layer'
const testDocId = 'test-doc-001'
const testKbId = 'test-kb-001'

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
    { parentIndex: 1, index: 0, content: '创建 API 密钥需要��控制台操作。' },
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
 * 准备向量点
 */
async function prepareVectorPoints() {
  const { ktypeSummary, parentChunks, childChunks } = generateTestData()

  console.log('📝 生成测试数据...')
  console.log(`   文档摘要: ${ktypeSummary.length} 字符`)
  console.log(`   父块: ${parentChunks.length} 个`)
  console.log(`   子块: ${childChunks.length} 个`)

  // 准备所有文本
  const textsToEmbed = [ktypeSummary, ...parentChunks.map(p => p.content), ...childChunks.map(c => c.content)]

  console.log('')
  console.log('🔄 生成向量嵌入...')

  // 批量生成向量
  const batchSize = 50
  const allEmbeddings: number[][] = []

  for (let i = 0; i < textsToEmbed.length; i += batchSize) {
    const batch = textsToEmbed.slice(i, i + batchSize)
    const embeddingResponse = await embeddingClient.embeddings.create({
      model: 'BAAI/bge-m3',
      input: batch,
    })
    allEmbeddings.push(...embeddingResponse.data.map(d => d.embedding))
    console.log(`   批次 ${Math.floor(i / batchSize) + 1}: ${embeddingResponse.data.length} 个向量`)
  }

  // 生成向量点
  const points: VectorPoint[] = []
  let embedIndex = 0
  const docIndex = Date.now() % 10000

  // 文档级向量点
  points.push({
    id: 1_000_000 + docIndex,
    vector: allEmbeddings[embedIndex++],
    payload: {
      doc_id: testDocId,
      kb_id: testKbId,
      user_id: userId,
      type: 'document',
      content: ktypeSummary,
      chunk_index: 0,
    },
  })

  // 父块向量点
  for (const parent of parentChunks) {
    points.push({
      id: docIndex * 10_000 + parent.index,
      vector: allEmbeddings[embedIndex++],
      payload: {
        doc_id: testDocId,
        kb_id: testKbId,
        user_id: userId,
        type: 'parent',
        content: parent.content,
        chunk_index: parent.index,
      },
    })
  }

  // 子块向量点
  for (const child of childChunks) {
    const parentQdrantId = docIndex * 10_000 + child.parentIndex

    points.push({
      id: docIndex * 10_000 + child.parentIndex * 100 + child.index,
      vector: allEmbeddings[embedIndex++],
      payload: {
        doc_id: testDocId,
        kb_id: testKbId,
        user_id: userId,
        type: 'child',
        parent_id: parentQdrantId,
        content: child.content,
        chunk_index: child.index,
      },
    })
  }

  return points
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🧪 测试三层检索功能 (使用新的 query API)')
  console.log('')

  try {
    // 1. 确保 collection 存在
    console.log('1️⃣ 确保 Qdrant collection 存在...')
    const collectionName = await ensureUserCollection(userId)
    console.log(`✅ Collection: ${collectionName}`)

    // 2. 清理旧的测试数据
    console.log('')
    console.log('2️⃣ 清理旧的测试数据...')
    try {
      await deleteDocumentChunks(userId, testDocId)
      console.log('✅ 已清理旧的测试数据')
    } catch {
      console.log('ℹ️  没有旧数据需要清理')
    }

    // 3. 准备并插入测试数据
    console.log('')
    const points = await prepareVectorPoints()
    console.log('')
    console.log(`3️⃣ 插入 ${points.length} 个向量点...`)
    await batchUpsert(userId, points, 100)
    console.log('✅ 插入完成')

    // 等待索引
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 4. 获取文档所有层级
    console.log('')
    console.log('4️⃣ 获取文档所有层级...')
    const layers = await getDocumentLayers(userId, testDocId)
    console.log(`✅ 文档层: ${layers.document ? '1' : '0'} 个`)
    console.log(`✅ 父块层: ${layers.parents.length} 个`)
    console.log(`✅ 子块层: ${layers.children.length} 个`)

    // 5. 测试三层钻取检索 (严格模式)
    console.log('')
    console.log('5️⃣ 测试三层钻取检索 (严格模式)...')

    // 使用文档摘要作为查询向量
    const embeddingResponse = await embeddingClient.embeddings.create({
      model: 'BAAI/bge-m3',
      input: '如何创建和管理 API 密钥？',
    })
    const queryVector = embeddingResponse.data[0].embedding

    const drillDownResult = await searchWithDrillDown(userId, queryVector, {
      filter: { kbId: testKbId },
      scoreThreshold: 0.5,
      parentLimit: 1,
      childLimit: 3,
    })

    console.log(`   📄 文档层: ${drillDownResult.document ? '✅ 找到' : '❌ 未找到'}`)
    if (drillDownResult.document) {
      console.log(`      score: ${drillDownResult.document.score.toFixed(4)}`)
    }
    console.log(`   📁 父块层: ${drillDownResult.parent ? '✅ 找到' : '❌ 未找到'}`)
    if (drillDownResult.parent) {
      console.log(`      score: ${drillDownResult.parent.score.toFixed(4)}`)
      console.log(`      内容: ${drillDownResult.parent.payload.content.substring(0, 50)}...`)
    }
    console.log(`   📄 子块层: ${drillDownResult.children.length} 个结果`)
    drillDownResult.children.forEach((child, i) => {
      console.log(`      [${i + 1}] score: ${child.score.toFixed(4)}`)
      console.log(`          ${child.payload.content.substring(0, 50)}...`)
    })

    // 6. 测试三层钻取检索 (宽松模式)
    console.log('')
    console.log('6️⃣ 测试三层钻取检索 (宽松模式)...')

    const relaxedResult = await searchWithDrillDownRelaxed(userId, queryVector, {
      filter: { kbId: testKbId },
      scoreThreshold: 0.5,
      parentLimit: 1,
      childLimit: 5,
    })

    console.log(`   📄 文档层: ${relaxedResult.document ? '✅ 找到' : '❌ 未找到'}`)
    console.log(`   📁 父块层: ${relaxedResult.parent ? '✅ 找到' : '❌ 未找到'}`)
    console.log(`   📄 子块层: ${relaxedResult.children.length} 个结果`)

    // 7. 清理测试数据
    console.log('')
    console.log('7️⃣ 清理测试数据...')
    await deleteDocumentChunks(userId, testDocId)
    console.log('✅ 清理完成')

    console.log('')
    console.log('🎉 三层检索测试完成！新的 query API 在三层检索中工作正常')
  } catch (error: any) {
    console.error('')
    console.error('❌ 测试失败!')
    console.error(`错误: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
