/**
 * 端到端测试 - 完整的 RAG 流程
 *
 * 测试流程:
 * 1. 读取并解析 test.pdf (使用 unpdf)
 * 2. K-Type 分析
 * 3. 父子分块
 * 4. 向量嵌入
 * 5. 存储到 Qdrant
 * 6. 召回测试
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'
import embeddingClient from '../lib/embedding.js'
import { parsePDF } from '../lib/parsers/pdf.js'
import { processKTypeWorkflowWithFallback } from '../lib/processors/k-type.js'
import { buildKTypeSummaryText, buildKTypeMetadata } from '../lib/processors/k-type-summary.js'
import { splitIntoParentChildChunksBatch } from '../lib/chunkers/parent-child.js'
import {
  ensureUserCollection,
  batchUpsert,
  deleteDocumentChunks,
  search,
  searchWithDrillDown,
  type VectorPoint,
} from '../lib/qdrant.js'

// 加载环境变量
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

// 测试配置
const userId = 'test-e2e-user'
const testDocId = 'test-e2e-pdf-doc'
const testKbId = 'test-e2e-kb'

/**
 * 主测试函数
 */
async function main() {
  console.log('🧪 端到端测试 - ���整 RAG 流程')
  console.log(''.repeat(60))

  try {
    // ==================== 1. 读取并解析 PDF ====================
    console.log('1️⃣ 读取并解析 PDF (使用 unpdf)...')
    const pdfPath = resolve(__dirname, '../test.pdf')

    const fileBuffer = readFileSync(pdfPath)
    // 转换 Buffer 为 Uint8Array (unpdf 需要)
    const pdfData = new Uint8Array(fileBuffer)
    console.log(`   📄 PDF 大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    const parseResult = await parsePDF(pdfData.buffer)
    console.log(`   ✅ 解析成功! 文本长度: ${parseResult.content.length} 字符`)
    console.log(`   📝 内容预览: ${parseResult.content.substring(0, 100)}...`)

    // ==================== 2. K-Type 分析 ====================
    console.log('')
    console.log('2️⃣ K-Type 分析...')

    const ktypeResult = await processKTypeWorkflowWithFallback(parseResult.content)
    const ktypeSummary = buildKTypeSummaryText(ktypeResult)
    const ktypeMetadata = buildKTypeMetadata(ktypeResult)

    console.log(`   ✅ K-Type 分析完成`)
    console.log(`   📊 主导类型: ${ktypeMetadata.dominant_type}`)
    console.log(`   📝 摘要长度: ${ktypeSummary.length} 字符`)
    console.log(`   📋 摘要预览: ${ktypeSummary.substring(0, 150)}...`)

    // ==================== 3. 父子分块 ====================
    console.log('')
    console.log('3️⃣ 父子分块...')

    const { parentChunks, childChunks } = await splitIntoParentChildChunksBatch(parseResult.content, {
      parentChunkSize: 1024,
      childChunkSize: 256,
      removeExtraSpaces: true,
      removeUrlsEmails: true,
    })

    console.log(`   ✅ 分块完成`)
    console.log(`   📦 父块: ${parentChunks.length} 个`)
    console.log(`   📄 子块: ${childChunks.length} 个`)

    // 调试：查看结构
    if (parentChunks.length > 0) {
      console.log(`   🔍 父块结构示例:`, JSON.stringify(parentChunks[0]).substring(0, 200))
    }
    if (childChunks.length > 0) {
      console.log(`   🔍 子块结构示例:`, JSON.stringify(childChunks[0]).substring(0, 200))
    }

    // ==================== 4. 确保 Qdrant Collection 存在 ====================
    console.log('')
    console.log('4️⃣ 准备 Qdrant...')

    const collectionName = await ensureUserCollection(userId)
    console.log(`   ✅ Collection: ${collectionName}`)

    // 清理旧数据
    try {
      await deleteDocumentChunks(userId, testDocId)
      console.log(`   🧹 已清理旧数据`)
    } catch {
      console.log(`   ℹ️  无旧数据需要清理`)
    }

    // ==================== 5. 向量嵌入 ====================
    console.log('')
    console.log('5️⃣ 生成向量嵌入...')

    const textsToEmbed = [
      ktypeSummary,
      ...parentChunks.map(p => p.content),
      ...childChunks.map(c => c.content),
    ]

    console.log(`   🔄 准备嵌入 ${textsToEmbed.length} 个文本块`)

    const batchSize = 50
    const allEmbeddings: number[][] = []

    for (let i = 0; i < textsToEmbed.length; i += batchSize) {
      const batch = textsToEmbed.slice(i, i + batchSize)
      const embeddingResponse = await embeddingClient.embeddings.create({
        model: 'BAAI/bge-m3',
        input: batch,
      })
      allEmbeddings.push(...embeddingResponse.data.map(d => d.embedding))
      console.log(`   ✅ 批次 ${Math.floor(i / batchSize) + 1}: ${embeddingResponse.data.length} 个向量`)
    }

    // ==================== 6. 准备向量点 ====================
    console.log('')
    console.log('6️⃣ 准备向量点...')

    const docIndex = Date.now() % 10000
    const points: VectorPoint[] = []
    let embedIndex = 0

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
        metadata: {
          ktype: ktypeMetadata,
          file_name: 'test.pdf',
        },
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
          metadata: {
            file_name: 'test.pdf',
          },
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
          metadata: {
            file_name: 'test.pdf',
            parent_index: child.parentIndex,
          },
        },
      })
    }

    console.log(`   ✅ 准备了 ${points.length} 个向量点`)
    console.log(`   📄 文档层: 1 个`)
    console.log(`   📁 父块层: ${parentChunks.length} 个`)
    console.log(`   📄 子块层: ${childChunks.length} 个`)

    // ==================== 7. 插入 Qdrant ====================
    console.log('')
    console.log('7️⃣ 插入 Qdrant...')

    await batchUpsert(userId, points, batchSize)
    console.log(`   ✅ 成功插入 ${points.length} 个向量点`)

    // 等待索引
    await new Promise(resolve => setTimeout(resolve, 2000))

    // ==================== 8. 显示 K-Type 摘要 ====================
    console.log('')
    console.log('8️⃣ K-Type 摘要')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log(ktypeSummary)
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // ==================== 9. 召回测试 ====================
    console.log('')
    console.log('9️⃣ 召回测试...')
    console.log('')

    // 生成测试问题
    const testQuestions = [
      '这个文档的主要内容是什么？',
      '文档中提到了哪些关键信息？',
      '有什么重要的步骤或流程？',
    ]

    for (let i = 0; i < testQuestions.length; i++) {
      const question = testQuestions[i]
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`问题 ${i + 1}: ${question}`)
      console.log('')

      // 生成查询向量
      const embeddingResponse = await embeddingClient.embeddings.create({
        model: 'BAAI/bge-m3',
        input: question,
      })
      const queryVector = embeddingResponse.data[0].embedding

      // 执行三层钻取检索
      const result = await searchWithDrillDown(userId, queryVector, {
        filter: { kbId: testKbId },
        scoreThreshold: 0.5,
        parentLimit: 1,
        childLimit: 3,
      })

      // 显示结果
      if (result.document) {
        console.log(`📄 文档层 (score: ${result.document.score.toFixed(4)})`)
        console.log(`   ${result.document.payload.content.substring(0, 100)}...`)
        console.log('')
      }

      if (result.parent) {
        console.log(`📁 父块层 (score: ${result.parent.score.toFixed(4)})`)
        console.log(`   ${result.parent.payload.content.substring(0, 150)}...`)
        console.log('')
      }

      console.log(`📄 子块层 (${result.children.length} 个结果)`)
      result.children.forEach((child, idx) => {
        console.log(`   [${idx + 1}] score: ${child.score.toFixed(4)}`)
        console.log(`       ${child.payload.content.substring(0, 100)}...`)
      })

      console.log('')
    }

    // ==================== 10. 清理 ====================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('🔟 清理测试数据...')
    console.log('   ⚠️  已跳过清理，数据保留在 Qdrant 中')
    console.log('')
    console.log('💡 查看摘要命令: npm run view:ktype ' + userId + ' ' + testDocId)
    console.log('')

    // await deleteDocumentChunks(userId, testDocId)
    // console.log('   ✅ 清理完成')

    console.log('')
    console.log('🎉 端到端测试完成！所有步骤执行成功')
  } catch (error: any) {
    console.error('')
    console.error('❌ 测试失败!')
    console.error(`错误: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
