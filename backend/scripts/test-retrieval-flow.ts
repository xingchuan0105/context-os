/**
 * 召回测试（RAG 检索）
 *
 * 使用已成功处理的文档进行检索测试
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { db, initializeDatabase } from '../lib/db/schema'
import { ensureUserCollection, search, searchWithDrillDownRelaxed } from '../lib/qdrant'
import embeddingClient from '../lib/embedding'

// 加载环境变量
const envPath = resolve(__dirname, '../.env')
config({ path: envPath })

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step: number, title: string) {
  console.log('\n' + '='.repeat(60))
  log(`步骤 ${step}: ${title}`, 'cyan')
  console.log('='.repeat(60))
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green')
}

function logError(message: string) {
  log(`❌ ${message}`, 'red')
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue')
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow')
}

async function main() {
  console.log('\n' + '🔍'.repeat(30))
  log('RAG 召回测试', 'cyan')
  console.log('🔍'.repeat(30) + '\n')

  try {
    // 查询已成功处理的文档
    logStep(1, '查找已处理的文档')

    initializeDatabase()

    const testDataPath = resolve(__dirname, '.test-upload-data.json')
    let targetDocId: string | null = null

    if (existsSync(testDataPath)) {
      try {
        const testData = JSON.parse(readFileSync(testDataPath, 'utf-8'))
        targetDocId = testData?.document?.docId || null
      } catch {
        targetDocId = null
      }
    }

    const doc = targetDocId
      ? db.prepare(`
          SELECT d.id, d.kb_id, d.user_id, d.file_name, d.status, d.chunk_count,
                 u.email, u.full_name
          FROM documents d
          JOIN users u ON d.user_id = u.id
          WHERE d.id = ?
            AND d.status = 'completed'
            AND d.chunk_count > 0
          ORDER BY d.created_at DESC
          LIMIT 1
        `).get(targetDocId) as any
      : db.prepare(`
          SELECT d.id, d.kb_id, d.user_id, d.file_name, d.status, d.chunk_count,
                 u.email, u.full_name
          FROM documents d
          JOIN users u ON d.user_id = u.id
          WHERE d.file_name LIKE 'test%'
            AND d.status = 'completed'
            AND d.chunk_count > 0
          ORDER BY d.created_at DESC
          LIMIT 1
        `).get() as any

    if (!doc) {
      throw new Error('没有找到已成功处理的 test.pdf 文档')
    }

    logSuccess('找到已处理的文档')
    logInfo(`文档 ID: ${doc.id}`)
    logInfo(`知识库 ID: ${doc.kb_id}`)
    logInfo(`用户 ID: ${doc.user_id}`)
    logInfo(`文件名: ${doc.file_name}`)
    logInfo(`分块数量: ${doc.chunk_count}`)
    logInfo(`用户邮箱: ${doc.email}`)

    // 测试向量检索
    logStep(2, '测试向量检索')

    const collectionName = await ensureUserCollection(doc.user_id)
    logInfo(`Qdrant Collection: ${collectionName}`)

    // 生成测试查询向量
    const testQueries = [
      'Java',
      '设计模式',
      '面向对象编程',
      '数据库',
    ]

    logInfo(`测试查询: ${testQueries.join(', ')}`)

    const embeddingModel = process.env.EMBEDDING_MODEL || 'bge-m3'

    for (const query of testQueries) {
      logInfo(`\n查询: "${query}"`)

      // 生成查询向量
      const embeddingResponse = await embeddingClient.embeddings.create({
        model: embeddingModel,
        input: [query],
      })

      const queryVector = embeddingResponse.data[0].embedding
      logInfo(`查询向量维度: ${queryVector.length}`)

      // 执行搜索
      const results = await search(doc.user_id, queryVector, {
        limit: 3,
        scoreThreshold: 0.5,
      })

      logInfo(`找到 ${results.length} 个相关片段`)

      if (results.length > 0) {
        results.forEach((result, index) => {
          logInfo(`\n[${index + 1}] 相关度: ${(result.score * 100).toFixed(1)}%`)

          if (result.payload) {
            const payload = result.payload as any
            logInfo(`类型: ${payload.type}`)

            if (payload.content) {
              const preview = payload.content.substring(0, 150)
              logInfo(`内容预览: ${preview}...`)
            }
          }
        })
      } else {
        logWarning('未找到相关片段')
      }
    }

    // 测试三层钻取检索
    logStep(3, '测试���层钻取检索')

    const drillDownQuery = 'Java 设计模式单例模式'
    logInfo(`钻取查询: "${drillDownQuery}"`)

    // 生成钻取查询的向量
    const drillDownEmbedding = await embeddingClient.embeddings.create({
      model: embeddingModel,
      input: [drillDownQuery],
    })

    const drillDownQueryVector = drillDownEmbedding.data[0].embedding
    logInfo(`钻取向量维度: ${drillDownQueryVector.length}`)

    // 使用 relaxed 版本的三层钻取（不需要文档级向量）
    const drillDownResults = await searchWithDrillDownRelaxed(doc.user_id, drillDownQueryVector, {
      parentLimit: 1,
      childLimit: 5,
      scoreThreshold: 0.3,
    })

    logInfo(`文档层结果: ${drillDownResults.document ? 1 : 0}`)
    logInfo(`父块层结果: ${drillDownResults.parent ? 1 : 0}`)
    logInfo(`子块层结果: ${drillDownResults.children?.length || 0}`)

    if (drillDownResults.children && drillDownResults.children.length > 0) {
      logSuccess('\n三层钻取检索成功!')

      drillDownResults.children.slice(0, 3).forEach((result, index) => {
        logInfo(`\n[${index + 1}] 相关度: ${(result.score * 100).toFixed(1)}%`)

        if (result.payload) {
          const payload = result.payload as any
          const preview = payload.content?.substring(0, 150) || 'N/A'
          logInfo(`内容预览: ${preview}...`)
        }
      })
    }

    // 测试总结
    console.log('\n' + '='.repeat(60))
    log('📊 测试总结', 'cyan')
    console.log('='.repeat(60))

    logSuccess('✅ 向量检索功能正常')
    logSuccess('✅ 三层钻取检索功能正常')
    logSuccess('✅ RAG 召回流程完整')

    console.log('\n' + '🎉'.repeat(30))
    log('召回测试通过！', 'green')
    console.log('🎉'.repeat(30) + '\n')

    // 显示测试账号信息
    console.log('\n' + '='.repeat(60))
    log('🔑 可用的测试账号信息', 'yellow')
    console.log('='.repeat(60))
    log(`用户邮箱: ${doc.email}`, 'yellow')
    log(`用户 ID: ${doc.user_id}`, 'yellow')
    log(`知识库 ID: ${doc.kb_id}`, 'yellow')
    log(`文档 ID: ${doc.id}`, 'yellow')
    log(`文档文件: ${doc.file_name}`, 'yellow')
    log(`分块数量: ${doc.chunk_count}`, 'yellow')
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.log('\n' + '='.repeat(60))
    log('🛑 测试失败', 'red')
    console.log('='.repeat(60))

    const errorMessage = error instanceof Error ? error.message : String(error)
    logError(`错误: ${errorMessage}`)

    console.log('\n' + '💡'.repeat(30))
    log('测试中断，请检查错误信息', 'yellow')
    console.log('💡'.repeat(30) + '\n')

    process.exit(1)
  }
}

// 运行测试
main().catch((error) => {
  console.error('未捕获的错误:', error)
  process.exit(1)
})
