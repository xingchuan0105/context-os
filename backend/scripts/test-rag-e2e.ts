/**
 * RAG 系统端到端测试脚本
 *
 * 测试完整流程：
 * 1. 上传文档
 * 2. 等待处理完成
 * 3. 验证向量化
 * 4. 测试检索
 * 5. 测试 RAG 问答
 */

import { config } from 'dotenv'
config()

import fs from 'fs'
import path from 'path'
import FormData from 'form-data'

const API_BASE = 'http://localhost:3000'
const KB_ID = process.env.TEST_KB_ID || ''

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function success(message: string) {
  log(`✅ ${message}`, 'green')
}

function error(message: string) {
  log(`❌ ${message}`, 'red')
}

function info(message: string) {
  log(`ℹ️  ${message}`, 'blue')
}

function warn(message: string) {
  log(`⚠️  ${message}`, 'yellow')
}

// 测试结果记录
const testResults: { name: string; passed: boolean; duration: number; error?: string }[] = []

async function runTest(
  name: string,
  testFn: () => Promise<void>
) {
  const startTime = Date.now()
  try {
    info(`Running: ${name}`)
    await testFn()
    const duration = Date.now() - startTime
    success(`${name} (${duration}ms)`)
    testResults.push({ name, passed: true, duration })
  } catch (err: any) {
    const duration = Date.now() - startTime
    error(`${name} failed: ${err.message}`)
    testResults.push({ name, passed: false, duration, error: err.message })
    throw err
  }
}

// ========== 测试用例 ==========

async function test_01_UploadDocument() {
  info('测试 1: 上传文档')

  // 创建测试文档
  const testContent = `
# 人工智能基础

## 什么是人工智能？

人工智能（Artificial Intelligence，简称 AI）是计算机科学的一个分支，
它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。

## 机器学习

机器学习是 AI 的一个子集，它使用算法来解析数据、从中学习，
然后对世界上的某事做出决定或预测。

## 深度学习

深度学习是机器学习的一个子集，它使用多层神经网络来学习数据的表示。
深度学习在图像识别、语音识别、自然语言处理等领域取得了突破性进展。

## 应用领域

1. 计算机视觉
2. 自然语言处理
3. 语音识别
4. 推荐系统
5. 自动驾驶
`.trim()

  const testFilePath = path.join(process.cwd(), 'test-ai-doc.txt')
  fs.writeFileSync(testFilePath, testContent, 'utf-8')

  try {
    const formData = new FormData()
    formData.append('file', fs.createReadStream(testFilePath))
    formData.append('kb_id', KB_ID)

    const response = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      body: formData as any,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    const data = await response.json()
    info(`上传成功，文档 ID: ${data.id}`)

    // 保存文档 ID 供后续测试使用
    process.env.TEST_DOC_ID = data.id

    return data.id
  } finally {
    // 清理测试文件
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
  }
}

async function test_02_WaitForProcessing(docId: string) {
  info('测试 2: 等待文档处理完成')

  const maxWaitTime = 60000 // 60 秒
  const checkInterval = 2000 // 2 秒
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(`${API_BASE}/api/documents/${docId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`)
    }

    const doc = await response.json()
    info(`文档状态: ${doc.status}, 处理进度: ${doc.processing_progress || 0}%`)

    if (doc.status === 'completed') {
      success(`文档处理完成，chunk 数量: ${doc.chunk_count}`)
      return doc
    }

    if (doc.status === 'failed') {
      throw new Error(`文档处理失败: ${doc.error_message || 'Unknown error'}`)
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  throw new Error('文档处理超时')
}

async function test_03_VerifyVectorization(docId: string) {
  info('测试 3: 验证向量化')

  // 检查文档的 chunks
  const response = await fetch(`${API_BASE}/api/documents/${docId}/chunks`)
  if (!response.ok) {
    throw new Error(`Failed to fetch chunks: ${response.status}`)
  }

  const chunks = await response.json()
  info(`获取到 ${chunks.length} 个 chunks`)

  if (chunks.length === 0) {
    throw new Error('没有找到任何 chunks')
  }

  // 验证每个 chunk 的向量
  for (const chunk of chunks.slice(0, 3)) {
    if (!chunk.vector_id) {
      warn(`Chunk ${chunk.id} 没有 vector_id`)
    } else {
      info(`Chunk ${chunk.id} → Vector: ${chunk.vector_id}`)
    }
  }

  success('向量化验证完成')
}

async function test_04_TestSearch(docId: string) {
  info('测试 4: 测试语义检索')

  const testQueries = [
    '什么是人工智能？',
    '机器学习的应用',
    '深度学习的原理',
  ]

  for (const query of testQueries) {
    info(`查询: "${query}"`)

    const response = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        kb_id: KB_ID,
        top_k: 3,
      }),
    })

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    const results = await response.json()
    info(`找到 ${results.length} 个结果`)

    if (results.length === 0) {
      warn(`查询 "${query}" 没有找到结果`)
    } else {
      results.forEach((result: any, index: number) => {
        info(`  结果 ${index + 1}: 相关性 ${result.score?.toFixed(3) || 'N/A'}`)
        info(`  内容: ${result.content?.substring(0, 100)}...`)
      })
    }

    // 验证至少有一个结果的相关性 > 0.5
    const hasGoodResult = results.some((r: any) => (r.score || 0) > 0.5)
    if (!hasGoodResult && results.length > 0) {
      warn(`查询 "${query}" 的结果相关性较低`)
    }
  }

  success('检索测试完成')
}

async function test_05_TestRAGChat() {
  info('测试 5: 测试 RAG 问答')

  const questions = [
    '文档中提到了哪些主要内容？',
    '详细说明机器学习的概念',
  ]

  // 创建会话
  const sessionResponse = await fetch(`${API_BASE}/api/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kb_id: KB_ID,
      title: 'RAG 测试会话',
    }),
  })

  if (!sessionResponse.ok) {
    throw new Error('Failed to create session')
  }

  const session = await sessionResponse.json()
  info(`创建会话: ${session.id}`)

  for (const question of questions) {
    info(`问题: "${question}"`)

    const response = await fetch(`${API_BASE}/api/chat/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
      }),
    })

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let citationCount = 0

    if (!reader) {
      throw new Error('No response body')
    }

    info('流式响应:')
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'token') {
              const content = event.data?.content || ''
              process.stdout.write(content)
              fullContent += content
            } else if (event.type === 'citation') {
              citationCount++
            } else if (event.type === 'done') {
              console.log('\n')
              info(`回答完成，引用数量: ${citationCount}`)
            } else if (event.type === 'error') {
              throw new Error(event.data?.message || 'Unknown error')
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    if (fullContent.length === 0) {
      throw new Error('没有收到回答内容')
    }

    info(`回答长度: ${fullContent.length} 字符`)
  }

  success('RAG 问答测试完成')
}

async function test_06_TestEdgeCases() {
  info('测试 6: 边界情况')

  // 6.1 查询不相关内容
  info('6.1 查询不相关内容')
  const response = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '怎么做蛋糕',
      kb_id: KB_ID,
      top_k: 3,
    }),
  })

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`)
  }

  const results = await response.json()
  if (results.length > 0) {
    const avgScore = results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / results.length
    if (avgScore > 0.5) {
      warn(`不相关查询返回了高相关性结果（平均分: ${avgScore.toFixed(3)}）`)
    } else {
      info('不相关查询返回低相关性结果（符合预期）')
    }
  } else {
    info('不相关查询返回空结果（符合预期）')
  }

  success('边界情况测试完成')
}

// ========== 主测试流程 ==========

async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗')
  log('║         RAG 系统端到端测试                                  ║')
  log('╚════════════════════════════════════════════════════════════╝\n')

  if (!KB_ID) {
    error('环境变量 TEST_KB_ID 未设置')
    error('请运行: export TEST_KB_ID=<your-kb-id>')
    process.exit(1)
  }

  try {
    // 测试 1: 上传文档
    const docId = await runTest('上传文档', test_01_UploadDocument)

    // 测试 2: 等待处理
    await runTest('等待文档处理', () => test_02_WaitForProcessing(docId))

    // 测试 3: 验证向量化
    await runTest('验证向量化', () => test_03_VerifyVectorization(docId))

    // 测试 4: 测试检索
    await runTest('测试语义检索', () => test_04_TestSearch(docId))

    // 测试 5: 测试 RAG 问答
    await runTest('测试 RAG 问答', test_05_TestRAGChat)

    // 测试 6: 边界情况
    await runTest('测试边界情况', test_06_TestEdgeCases)

  } catch (err) {
    error('\n测试失败，请检查错误信息')
  }

  // 打印测试报告
  log('\n' + '═'.repeat(60))
  log('📊 测试报告')
  log('═'.repeat(60))

  const passed = testResults.filter(r => r.passed).length
  const failed = testResults.filter(r => !r.passed).length
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0)

  log(`总计: ${testResults.length} 个测试`)
  log(`通过: ${passed} 个`)
  log(`失败: ${failed} 个`)
  log(`总耗时: ${(totalDuration / 1000).toFixed(2)}s`)

  if (failed > 0) {
    log('\n失败的测试:')
    testResults.filter(r => !r.passed).forEach(r => {
      error(`  - ${r.name}: ${r.error}`)
    })
  }

  log('═'.repeat(60) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

main()
