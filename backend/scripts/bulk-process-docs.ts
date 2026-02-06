/**
 * 批量处理 docs/ 下的 Markdown 文档（以及少量根目录文档），然后运行 RAG 召回测试。
 * 使用本地 SQLite + Qdrant，跳过 K-Type，仅做分块 + 向量化 + 三层索引。
 */
import 'dotenv/config'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import { v4 as uuidv4 } from 'uuid'

import { initializeDatabase, db } from '../lib/db/schema'
import { processDocumentWithText } from '../lib/processors/document-processor'
import type { Document } from '../lib/db/queries'
import { runAllTests } from './rag-test/run-rag-test'

const TEST_EMAIL = 'rag-test@context-os.local'
const KB_TITLE = 'RAG 测试知识库'

function ensureUserAndKb() {
  initializeDatabase()

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(TEST_EMAIL) as any
  if (!user) {
    const userId = uuidv4()
    db.prepare(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
    ).run(userId, TEST_EMAIL, 'test-hash', 'RAG Test User')
    user = { id: userId, email: TEST_EMAIL }
    console.log(`✅ 创建测试用户: ${user.id}`)
  } else {
    console.log(`✅ 使用现有测试用户: ${user.id}`)
  }

  let kb = db
    .prepare('SELECT * FROM knowledge_bases WHERE user_id = ? AND title = ?')
    .get(user.id, KB_TITLE) as any
  if (!kb) {
    const kbId = uuidv4()
    db.prepare(
      'INSERT INTO knowledge_bases (id, user_id, title, description) VALUES (?, ?, ?, ?)'
    ).run(kbId, user.id, KB_TITLE, '批量 ingest docs/')
    kb = { id: kbId, title: KB_TITLE }
    console.log(`✅ 创建测试知识库: ${kb.id}`)
  } else {
    console.log(`✅ 使用现有测试知识库: ${kb.id}`)
  }

  // 清理旧文档
  const oldDocs = db.prepare('SELECT id, file_name FROM documents WHERE kb_id = ?').all(kb.id) as {
    id: string
    file_name: string
  }[]
  if (oldDocs.length > 0) {
    for (const doc of oldDocs) {
      db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id)
      console.log(`  🗑️ 删除旧文档: ${doc.file_name} (${doc.id})`)
    }
  }

  return { userId: user.id as string, kbId: kb.id as string }
}

function collectDocs(): string[] {
  const docDir = join(process.cwd(), 'docs')
  const docs = readdirSync(docDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(docDir, f))

  const rootCandidates = [
    'README.md',
    'PRD.md',
    'MIGRATION_GUIDE.md',
    'DOCKER_QUICKSTART.md',
    'DOCKER_STATUS.md',
    'LITELLM_CONFIG_GUIDE.md',
    'LITELLM_QUICKSTART.md',
    'LITELLM_MIGRATION.md',
  ]
  const rootDocs = Array.from(new Set(rootCandidates))
    .map((f) => join(process.cwd(), f))
    .filter((p) => existsSync(p))

  return [...docs, ...rootDocs]
}

async function ingestOne(filePath: string, userId: string, kbId: string) {
  const content = readFileSync(filePath, 'utf-8')
  const docId = uuidv4()
  const fileName = basename(filePath)

  db.prepare(
    `INSERT INTO documents (
      id, kb_id, user_id, file_name, storage_path,
      file_content, mime_type, file_size, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`
  ).run(
    docId,
    kbId,
    userId,
    fileName,
    `local://${fileName}`,
    content,
    'text/markdown',
    Buffer.byteLength(content, 'utf-8')
  )

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as Document
  console.log(`\n📝 开始处理: ${fileName} (docId=${docId})`)
  const result = await processDocumentWithText(
    doc,
    content,
    {
      skipKType: true,
    },
    (p) => {
      process.stdout.write(`   [${fileName}] ${p.message} (${p.progress}%)\r`)
    }
  )
  process.stdout.write('\n')
  if (result.success) {
    console.log(`✅ 完成: ${fileName}`)
  } else {
    console.log(`❌ 失败: ${fileName} - ${result.error}`)
  }
}

async function main() {
  const { userId, kbId } = ensureUserAndKb()
  const files = collectDocs()

  console.log(`\n📚 待处理文档数: ${files.length}`)
  for (const f of files) {
    await ingestOne(f, userId, kbId)
  }

  console.log('\n🧪 运行召回测试...')
  const report = await runAllTests({ userId, kbId })
  console.log('\n============================================================')
  console.log('测试结果汇总')
  console.log('============================================================')
  console.log(`  总用例数: ${report.summary.totalCases}`)
  console.log(`  通过数:   ${report.summary.passedCases}`)
  console.log(`  通过率:   ${(report.summary.passRate * 100).toFixed(1)}%`)
  console.log(`  综合得分: ${(report.summary.overallScore * 100).toFixed(1)}%`)
  console.log(`  平均延迟: ${report.summary.avgLatency.toFixed(0)}ms`)
  console.log('============================================================')
}

main().catch((err) => {
  console.error('批量处理失败:', err)
  process.exit(1)
})
