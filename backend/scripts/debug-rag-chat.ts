/**
 * 调试 RAG 检索问题
 * 使用会话中的真实 userId 和 kbId 测试
 */
import 'dotenv/config'

// 设置默认环境变量
if (!process.env.EMBEDDING_MODEL) {
  process.env.EMBEDDING_MODEL = 'qwen3-embedding-4b'
}

import { ragRetrieve } from '../lib/rag/retrieval'
import { getDocumentsByNotebookId } from '../lib/db/queries'
import { healthCheck, listCollections, getUserCollectionName } from '../lib/qdrant'
import { db } from '../lib/db/schema'

// 从会话数据中获取的真实 ID
const USER_ID = process.env.DEBUG_USER_ID || '823590bf-83ad-4140-a263-c9bc6b3fda1e'
const KB_ID = process.env.DEBUG_KB_ID || 'e6499217-e24b-46f5-805b-ea994ec27aaa'
const QUERY = process.env.DEBUG_QUERY || '文章的主要内容和观点是什么？'

async function main() {
  console.log('=== RAG 调试脚本 ===\n')

  // 1. 检查 Qdrant 连接
  console.log('[1] 检查 Qdrant 连接...')
  const qdrantOk = await healthCheck()
  console.log(`    Qdrant 状态: ${qdrantOk ? '✓ 正常' : '✗ 失败'}`)
  if (!qdrantOk) {
    console.error('Qdrant 连接失败，请检查服务是否运行')
    process.exit(1)
  }

  // 2. 列出所有 collections
  console.log('\n[2] 列出 Qdrant collections...')
  const collections = await listCollections()
  console.log(`    Collections: ${collections.join(', ') || '(无)'}`)

  // 3. 检查用户的 collection 是否存在
  const userCollection = getUserCollectionName(USER_ID)
  console.log(`\n[3] 检查用户 collection: ${userCollection}`)
  const hasUserCollection = collections.includes(userCollection)
  console.log(`    存在: ${hasUserCollection ? '✓ 是' : '✗ 否'}`)

  if (!hasUserCollection) {
    console.error(`\n错误: 用户 collection "${userCollection}" 不存在！`)
    console.log('可能原因:')
    console.log('  1. 文档尚未处理完成')
    console.log('  2. userId 不正确')
    process.exit(1)
  }

  // 4. 检查数据库中的知识库和文档
  console.log('\n[4] 检查数据库中的知识库...')
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(KB_ID) as any
  if (kb) {
    console.log(`    知识库: ${kb.title} (id=${kb.id})`)
    console.log(`    用户ID: ${kb.user_id}`)
  } else {
    console.log(`    ✗ 知识库不存在: ${KB_ID}`)
  }

  // 5. 检查知识库中的文档
  console.log('\n[5] 检查知识库中的文档...')
  const docs = await getDocumentsByNotebookId(KB_ID)
  console.log(`    文档数量: ${docs.length}`)
  for (const doc of docs) {
    console.log(`    - ${doc.file_name} (id=${doc.id}, status=${doc.status}, chunks=${doc.chunk_count || 0})`)
    if (doc.ktype_summary) {
      console.log(`      ktype_summary: ${doc.ktype_summary.slice(0, 100)}...`)
    }
  }

  if (docs.length === 0) {
    console.error('\n错误: 知识库中没有文档！')
    process.exit(1)
  }

  // 6. 执行 RAG 检索
  console.log('\n[6] 执行 RAG 检索...')
  console.log(`    Query: "${QUERY}"`)
  console.log(`    userId: ${USER_ID}`)
  console.log(`    kbId: ${KB_ID}`)

  try {
    const result = await ragRetrieve(USER_ID, QUERY, {
      kbId: KB_ID,
      documentIds: [],
      scoreThreshold: 0.3,
      documentLimit: 6,
      documentTopK: 3,
      parentLimit: 8,
      childLimit: 8,
      childLimitFromDocs: 8,
      childLimitGlobal: 8,
      childTopK: 8,
      rerank: true,
      enableDocRouting: false,
    })

    console.log('\n[7] RAG 检索结果:')
    console.log(`    totalResults: ${result.totalResults}`)
    console.log(`    documents: ${result.context.documents?.length || (result.context.document ? 1 : 0)}`)
    console.log(`    parents: ${result.context.parents.length}`)
    console.log(`    children: ${result.context.children.length}`)

    if (result.context.documents && result.context.documents.length > 0) {
      console.log('\n    === Documents ===')
      for (const doc of result.context.documents) {
        console.log(`    [score=${doc.score.toFixed(3)}] ${doc.payload.content.slice(0, 200)}...`)
      }
    } else if (result.context.document) {
      console.log('\n    === Document ===')
      console.log(`    [score=${result.context.document.score.toFixed(3)}] ${result.context.document.payload.content.slice(0, 200)}...`)
    } else {
      console.log('\n    === Documents: (无) ===')
    }

    if (result.context.parents.length > 0) {
      console.log('\n    === Parents ===')
      for (const parent of result.context.parents.slice(0, 3)) {
        console.log(`    [score=${parent.score.toFixed(3)}] ${parent.payload.content.slice(0, 200)}...`)
      }
    } else {
      console.log('\n    === Parents: (无) ===')
    }

    if (result.context.children.length > 0) {
      console.log('\n    === Children ===')
      for (const child of result.context.children.slice(0, 3)) {
        console.log(`    [score=${child.score.toFixed(3)}] ${child.payload.content.slice(0, 200)}...`)
      }
    } else {
      console.log('\n    === Children: (无) ===')
    }

  } catch (err) {
    console.error('\nRAG 检索失败:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) {
      console.error(err.stack)
    }
    process.exit(1)
  }

  console.log('\n=== 调试完成 ===')
}

main().catch((err) => {
  console.error('脚本执行失败:', err)
  process.exit(1)
})
