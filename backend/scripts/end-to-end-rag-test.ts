/**
 * 瀹屾暣鐨勭鍒扮 RAG 娴嬭瘯
 * 1. 鍒涘缓娴嬭瘯鐢ㄦ埛鍜岀煡璇嗗簱
 * 2. 涓婁紶 test.pdf
 * 3. 绛夊緟鏂囨。澶勭悊瀹屾垚
 * 4. 杩愯 RAG 鍙洖娴嬭瘯
 */

import { signToken } from '../lib/auth/jwt'
import { db } from '../lib/db/schema'
import { readFileSync } from 'fs'
import { join } from 'path'

const API_BASE = process.env.API_BASE || 'http://localhost:3001'

// ==================== 宸ュ叿鍑芥暟 ====================

async function makeRequest(
  endpoint: string,
  options: {
    method?: string
    body?: any
    token?: string
    isFormData?: boolean
  } = {}
) {
  const { method = 'GET', body, token, isFormData } = options

  const headers: Record<string, string> = {}
  if (token) {
    headers['Cookie'] = `auth_token=${token}`
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const config: RequestInit = {
    method,
    headers,
  }

  if (body) {
    if (isFormData) {
      config.body = body as any
    } else {
      config.body = JSON.stringify(body)
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config)
  const data = await response.json().catch(() => null)

  return {
    ok: response.ok,
    status: response.status,
    data,
  }
}

// ==================== 姝ラ 1: 鍒涘缓娴嬭瘯鐢ㄦ埛 ====================

async function createTestUser() {
  console.log('\n📒 步骤 1: 创建测试用户...')

  const existing = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get('test@context-os.local')

  if (existing) {
    console.log('✅测试用户已存在', (existing as any).id)
    return existing as { id: string; email: string; full_name: string | null }
  }

  const userId = 'test-user-' + Date.now()
  db.prepare(
    'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
  ).run(userId, 'test@context-os.local', 'hash', 'RAG Test User')

  console.log('✅创建测试用户:', userId)
  return { id: userId, email: 'test@context-os.local', full_name: 'RAG Test User' }
}

// ==================== 姝ラ 2: 鍒涘缓鐭ヨ瘑搴?====================

async function createKnowledgeBase(userId: string) {
  console.log('\n📚 步骤 2: 创建知识库...')

  const existing = db
    .prepare('SELECT * FROM knowledge_bases WHERE user_id = ? AND title = ?')
    .get(userId, 'RAG 测试知识库')

  if (existing) {
    console.log('✅测试知识库已存在:', (existing as any).id)
    return existing as { id: string; title: string }
  }

  const kbId = 'kb-test-' + Date.now()
  db.prepare(
    'INSERT INTO knowledge_bases (id, user_id, title, description) VALUES (?, ?, ?, ?)'
  ).run(kbId, userId, 'RAG 测试知识库', '用于 RAG 召回测试的知识库')

  console.log('✅创建知识库', kbId)
  return { id: kbId, title: 'RAG 测试知识库' }
}

// ==================== 姝ラ 3: 涓婁紶鏂囨。 ====================

async function uploadDocument(userId: string, kbId: string, token: string) {
  console.log('\n📤 步骤 3: 上传 test.pdf...')

  const pdfPath = join(process.cwd(), 'test.pdf')

  // 读取 PDF 文件
  const pdfBuffer = readFileSync(pdfPath)
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' })
  const pdfFile = new File([pdfBlob], 'test.pdf', { type: 'application/pdf' })

  console.log(`📄 文件大小: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`)

  // 创建 FormData
  const formData = new FormData()
  formData.append('file', pdfFile)
  formData.append('kb_id', kbId)
  formData.append('autoProcess', 'true')

  // 上传
  const result = await makeRequest('/api/documents', {
    method: 'POST',
    token,
    isFormData: true,
    body: formData,
  })

  if (!result.ok) {
    console.error('上传失败:', result.data)
    throw new Error('上传失败: ' + JSON.stringify(result.data))
  }

  const payload: any = (result.data as any)?.data || result.data

  console.log('✅上传成功!')
  console.log('   文档ID:', payload?.document?.id)
  console.log('   自动处理:', payload?.autoProcessTriggered)

  return payload.document as { id: string; name: string; status: string }
}

// ==================== 姝ラ 4: 绛夊緟澶勭悊瀹屾垚 ====================

async function waitForProcessing(docId: string, maxWaitSeconds = 300) {
  console.log('\n⌛ 步骤 4: 等待文档处理...')

  const startTime = Date.now()
  const maxWait = maxWaitSeconds * 1000

  while (Date.now() - startTime < maxWait) {
    const doc = db
      .prepare('SELECT status, error_message, chunk_count FROM documents WHERE id = ?')
      .get(docId) as { status: string; error_message: string | null; chunk_count: number } | undefined

    if (!doc) {
      console.log('⚠️  文档不存在')
      return false
    }

    console.log(`   状态 ${doc.status.padEnd(12)} | 已过 ${Math.round((Date.now() - startTime) / 1000)}s`)

    if (doc.status === 'completed') {
      console.log('✅文档处理完成!')
      console.log(`   分块数量: ${doc.chunk_count}`)
      return true
    }

    if (doc.status === 'failed') {
      console.error('❌文档处理失败!')
      console.error('   错误:', doc.error_message)
      return false
    }

    // 等待 2 秒后重试
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log('⌛等待超时')
  return false
}

// ==================== 步骤 5: 验证 Qdrant 索引 ====================

async function verifyQdrantIndexing(userId: string, docId: string) {
  console.log('\n馃攳 姝ラ 5: 楠岃瘉 Qdrant 绱㈠紩...')

  const collectionName = `user_${userId}_vectors`

  // 浣跨敤 fetch 鏌ヨ Qdrant
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'

  try {
    // 鑾峰彇闆嗗悎淇℃伅
    const infoResponse = await fetch(`${qdrantUrl}/collections/${collectionName}`)
    if (!infoResponse.ok) {
      console.log('鈿狅笍  闆嗗悎涓嶅瓨鍦?', collectionName)
      return false
    }

    const info = await infoResponse.json()
    const pointsCount = info.result?.points_count || 0

    console.log(`鉁?闆嗗悎瀛樺湪: ${collectionName}`)
    console.log(`   鍚戦噺鎬绘暟: ${pointsCount}`)

    // 鏌ヨ璇ユ枃妗ｇ殑鍚戦噺
    const filterResponse = await fetch(`${qdrantUrl}/collections/${collectionName}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            {
              key: 'doc_id',
              match: { value: docId },
            },
          ],
        },
        limit: 1,
        with_payload: true,
      }),
    })

    if (filterResponse.ok) {
      const scrollResult = await filterResponse.json()
      const matchedPoints = scrollResult.result?.points?.length || 0

      console.log(`   文档向量数: ${matchedPoints}`)

      // 统计各层级的向量数
      const layerCounts = { document: 0, parent: 0, child: 0 }
      const scrollAll = await fetch(`${qdrantUrl}/collections/${collectionName}/points/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [{ key: 'doc_id', match: { value: docId } }],
          },
          limit: 10000,
          with_payload: ['type'],
        }),
      })

      if (scrollAll.ok) {
        const allPoints = await scrollAll.json()
        for (const point of allPoints.result?.points || []) {
          const type = point.payload?.type
          if (type && type in layerCounts) {
            layerCounts[type as keyof typeof layerCounts]++
          }
        }
      }

      console.log(`   鍒嗗眰缁熻:`)
      console.log(`     - Document 灞? ${layerCounts.document}`)
      console.log(`     - Parent 灞?   ${layerCounts.parent}`)
      console.log(`     - Child 灞?    ${layerCounts.child}`)

      return matchedPoints > 0
    }

    return false
  } catch (error) {
    console.error('鉂?Qdrant 鏌ヨ澶辫触:', error)
    return false
  }
}

// ==================== 姝ラ 6: 杩愯 RAG 鍙洖娴嬭瘯 ====================

async function runRagTests(userId: string, kbId: string) {
  console.log('\n馃И 姝ラ 6: 杩愯 RAG 鍙洖娴嬭瘯...')

  // 瀵煎叆娴嬭瘯妯″潡
  const { runAllTests } = await import('./rag-test/run-rag-test')

  const report = await runAllTests({
    userId,
    kbId,
  })

  return report
}

// ==================== 涓绘祦绋?====================

async function main() {
  console.log(`
============================================================
          ContextOS RAG 端到端测试
============================================================
  `)

  try {
    // 1. 创建测试用户
    const user = await createTestUser()

    // 生成 JWT Token
    const token = await signToken({
      userId: user.id,
      email: user.email,
    })

    // 2. 创建知识库
    const kb = await createKnowledgeBase(user.id)

    // 3. 上传文档
    const doc = await uploadDocument(user.id, kb.id, token)

    // 4. 等待处理完成
    const processed = await waitForProcessing(doc.id, 300)

    if (!processed) {
      console.log('\n❌ 文档处理失败，终止测试')
      process.exit(1)
    }

    // 5. 验证索引
    const indexed = await verifyQdrantIndexing(user.id, doc.id)

    if (!indexed) {
      console.log('\n❌ Qdrant 索引验证失败，终止测试')
      process.exit(1)
    }

    // 6. 运行召回测试
    const report = await runRagTests(user.id, kb.id)

    // 输出结果
    console.log('\n' + '='.repeat(60))
    console.log('                    测试结果汇总')
    console.log('='.repeat(60))
    console.log(`  总用例数:    ${report.summary.totalCases}`)
    console.log(`  通过数:      ${report.summary.passedCases}`)
    console.log(`  通过率:      ${(report.summary.passRate * 100).toFixed(1)}%`)
    console.log(`  综合得分:    ${(report.summary.overallScore * 100).toFixed(1)}%`)
    console.log('='.repeat(60))

    process.exit(report.summary.passRate >= 0.5 ? 0 : 1)
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { main }



