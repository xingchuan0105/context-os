/**
 * 端到端 RAG 测试 - 独立脚本（直接调用库函数，绕过 Next.js API）
 *
 * 步骤：
 * 1. 创建测试用户和知识库
 * 2. 解析 test.pdf
 * 3. 处理文档（KTYPE + 分块 + 向量化）
 * 4. 验证 Qdrant 索引
 * 5. 运行 RAG 召回测试
 */

import 'dotenv/config'
import Database from 'better-sqlite3'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

// 直接导入处理函数
import { parseFile, formatAsMarkdown, toMarkdownFileName } from '../lib/parsers'
import { processDocumentWithText } from '../lib/processors/document-processor'
import { uploadMarkdownToLocal } from '../lib/storage/local'
import { getUserCollectionInfo } from '../lib/qdrant'

const dbPath = join(process.cwd(), 'data', 'context-os.db')
const db = new Database(dbPath)

// ==================== 工具函数 ====================

function createId() {
  return uuidv4()
}

// ==================== 步骤 1: 创建测试用户和知识库 ====================

function setupTestEnvironment() {
  console.log('\n📝 步骤 1: 设置测试环境...')

  // 检查或创建测试用户
  let user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get('rag-test@context-os.local') as { id: string; email: string } | undefined

  if (!user) {
    const userId = createId()
    db.prepare(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
    ).run(userId, 'rag-test@context-os.local', 'test-hash', 'RAG Test User')
    user = { id: userId, email: 'rag-test@context-os.local' }
    console.log('✅ 创建测试用户:', user.id)
  } else {
    console.log('✅ 使用现有测试用户:', user.id)
  }

  // 检查或创建测试知识库
  let kb = db
    .prepare('SELECT * FROM knowledge_bases WHERE user_id = ? AND title = ?')
    .get(user.id, 'RAG 测试知识库') as { id: string; title: string } | undefined

  if (!kb) {
    const kbId = createId()
    db.prepare(
      'INSERT INTO knowledge_bases (id, user_id, title, description) VALUES (?, ?, ?, ?)'
    ).run(kbId, user.id, 'RAG 测试知识库', '用于 RAG 召回测试的知识库')
    kb = { id: kbId, title: 'RAG 测试知识库' }
    console.log('✅ 创建测试知识库:', kb.id)
  } else {
    console.log('✅ 使用现有测试知识库:', kb.id)
  }

  // 清理该知识库下的旧文档
  const oldDocs = db
    .prepare('SELECT id FROM documents WHERE kb_id = ?')
    .all(kb.id) as { id: string }[]

  for (const oldDoc of oldDocs) {
    db.prepare('DELETE FROM documents WHERE id = ?').run(oldDoc.id)
    console.log('  🗑️  删除旧文档:', oldDoc.id)
  }

  return { user, kb }
}

// ==================== 步骤 2: 解析 PDF ====================

async function parsePDF(filePath: string) {
  console.log('\n📄 步骤 2: 解析 PDF 文件...')

  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }

  const pdfBuffer = readFileSync(filePath)
  console.log(`   文件大小: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`)

  const parseResult = await parseFile(pdfBuffer, 'application/pdf', 'test.pdf')
  console.log(`✅ 解析完成: 提取了 ${parseResult.content.length} 字符`)

  return parseResult
}

// ==================== 步骤 3: 保存文档记录 ====================

async function saveDocument(
  kbId: string,
  userId: string,
  fileName: string,
  content: string
) {
  console.log('\n💾 步骤 3: 保存文档记录...')

  const docId = createId()
  const mdFileName = toMarkdownFileName(fileName)
  const markdownContent = formatAsMarkdown(content, fileName)

  // 存储到本地
  const uploadResult = await uploadMarkdownToLocal(userId, kbId, mdFileName, markdownContent)
  console.log('   存储路径:', uploadResult.path)

  // 创建数据库记录
  db.prepare(
    `INSERT INTO documents (
      id, kb_id, user_id, file_name, storage_path, mime_type, file_size,
      status, file_content
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    docId,
    kbId,
    userId,
    fileName,
    uploadResult.path,
    'text/markdown',
    Buffer.byteLength(markdownContent, 'utf-8'),
    'queued',
    uploadResult.base64Content || null
  )

  console.log('✅ 文档记录已创建:', docId)

  return { docId, content: markdownContent }
}

// ==================== 步骤 4: 处理文档 ====================

async function processDocument(docId: string, extractedText: string) {
  console.log('\n⚙️  步骤 4: 处理文档 (KTYPE + 分块 + 向量化)...')

  // 获取完整文档对象（包含 user_id）
  const doc = db
    .prepare('SELECT * FROM documents WHERE id = ?')
    .get(docId) as { id: string; user_id: string; kb_id: string } | undefined

  if (!doc) {
    throw new Error(`文档不存在: ${docId}`)
  }

  // 更新状态为处理中
  db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('processing', docId)

  try {
    const result = await processDocumentWithText(
      doc as any,
      extractedText,
      {
        skipKType: true,
      },
      (progress) => {
        console.log(`   进度: ${progress.message} (${progress.progress}%)`)
      }
    )

    if (result.success) {
      console.log('✅ 文档处理完成!')

      const chunkCount =
        (result.stats?.parentChunks || 0) +
        (result.stats?.childChunks || 0) +
        (result.stats?.documentChunks || 0)

      // 更新数据库
      db.prepare(
        'UPDATE documents SET status = ?, chunk_count = ? WHERE id = ?'
      ).run('completed', chunkCount, docId)

      return true
    } else {
      console.error('❌ 文档处理失败:', result.error)
      db.prepare(
        'UPDATE documents SET status = ?, error_message = ? WHERE id = ?'
      ).run('failed', result.error || 'Unknown error', docId)
      return false
    }
  } catch (error) {
    console.error('❌ 处理异常:', error)
    db.prepare(
      'UPDATE documents SET status = ?, error_message = ? WHERE id = ?'
    ).run('failed', (error as Error).message, docId)
    return false
  }
}

// ==================== ���骤 5: 验证 Qdrant 索引 ====================

async function verifyQdrantIndexing(userId: string, docId: string) {
  console.log('\n🔍 步骤 5: 验证 Qdrant 索引...')

  try {
    const info = await getUserCollectionInfo(userId)

    if (!info) {
      console.log('⚠️  集合不存在')
      return false
    }

    console.log(`✅ 集合存在: user_${userId}_vectors`)
    console.log(`   向量总数: ${info.result?.points_count || 0}`)

    // 使用 getDocumentLayers 获取该文档的向量
    const { getDocumentLayers } = await import('../lib/qdrant')
    const layers = await getDocumentLayers(userId, docId)

    console.log(`   文档向量数:`)
    console.log(`     - Document 层: ${layers.document ? 1 : 0}`)
    console.log(`     - Parent 层:   ${layers.parents.length}`)
    console.log(`     - Child 层:    ${layers.children.length}`)

    const totalVectors = (layers.document ? 1 : 0) + layers.parents.length + layers.children.length
    return totalVectors > 0
  } catch (error) {
    console.error('❌ Qdrant 查询失败:', error)
    return false
  }
}

// ==================== 步骤 6: 运行 RAG 召回测试 ====================

async function runRagRecallTests(userId: string, kbId: string) {
  console.log('\n🧪 步骤 6: 运行 RAG 召回测试...')

  const { runAllTests } = await import('./rag-test/run-rag-test')

  const report = await runAllTests({
    userId,
    kbId,
  })

  return report
}

// ==================== 主流程 ====================

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          ContextOS RAG 端到端测试 (独立模式)                ║
╚════════════════════════════════════════════════════════════╝
  `)

  try {
    // 1. 设置测试环境
    const { user, kb } = setupTestEnvironment()

    // 2. 解析 PDF
    const pdfPath = join(process.cwd(), 'test.pdf')
    const parseResult = await parsePDF(pdfPath)

    // 3. 保存文档记录
    const { docId } = await saveDocument(kb.id, user.id, 'test.pdf', parseResult.content)

    // 4. 处理文档
    // 跳过 K-Type，专注重分块 + 向量化 + 召回
    const processed = await processDocument(docId, parseResult.content, {
      skipKType: true,
    })

    if (!processed) {
      console.log('\n❌ 文档处理失败，终止测试')
      process.exit(1)
    }

    // 5. 验证索引
    const indexed = await verifyQdrantIndexing(user.id, docId)

    if (!indexed) {
      console.log('\n❌ Qdrant 索引验证失败，终止测试')
      process.exit(1)
    }

    // 6. 运行召回测试
    const report = await runRagRecallTests(user.id, kb.id)

    // 输出结果
    console.log('\n' + '='.repeat(60))
    console.log('                    测试结果汇总')
    console.log('='.repeat(60))
    console.log(`  总用例数:    ${report.summary.totalCases}`)
    console.log(`  通过数:      ${report.summary.passedCases}`)
    console.log(`  通过率:      ${(report.summary.passRate * 100).toFixed(1)}%`)
    console.log(`  综合得分:    ${(report.summary.overallScore * 100).toFixed(1)}%`)
    console.log(`  平均延迟:    ${report.summary.avgLatency.toFixed(0)}ms`)
    console.log('='.repeat(60))

    process.exit(report.summary.passRate >= 0.3 ? 0 : 1)
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  } finally {
    db.close()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { main }
