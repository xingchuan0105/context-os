/**
 * 完整的文档上传和嵌入测试
 * 包含：注册用户 -> 创建知识库 -> 上传文档 -> 等待处理完成
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { Blob } from 'buffer'

// 加载环境变量
const envPath = resolve(process.cwd(), '.env')
config({ path: envPath })

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010'

let cookies: string = ''
let userId: string = ''
let kbId: string = ''

// ==================== 认证 ====================

async function registerUser(email: string, password: string) {
  console.log('🔐 注册测试用户...')

  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name: 'Test User' }),
  })

  if (!response.ok) {
    const error = await response.json()
    if (JSON.stringify(error).includes('已被注册')) {
      console.log('  用户已存在，直接登录')
      return await loginUser(email, password)
    }
    throw new Error(`注册失败: ${JSON.stringify(error)}`)
  }

  // Extract cookies from response
  const setCookieHeader = response.headers.get('set-cookie')
  if (setCookieHeader) {
    cookies = setCookieHeader.split(';')[0] // Get just the cookie value
  }

  const result = await response.json()
  userId = result.user.id

  console.log(`✅ 注册成功`)
  console.log(`  用户ID: ${userId}`)
  return result
}

async function loginUser(email: string, password: string) {
  console.log('🔑 登录测试用户...')

  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`登录失败: ${JSON.stringify(error)}`)
  }

  // Extract cookies from response
  const setCookieHeader = response.headers.get('set-cookie')
  if (setCookieHeader) {
    cookies = setCookieHeader.split(';')[0] // Get just the cookie value
  }

  const result = await response.json()
  userId = result.user.id

  console.log(`✅ 登录成功`)
  console.log(`  用户ID: ${userId}`)
  return result
}

// ==================== 知识库 ====================

async function createKnowledgeBase(title: string, description: string) {
  console.log('\n📚 创建知识库...')

  const response = await fetch(`${API_BASE}/api/knowledge-bases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: JSON.stringify({ title, description }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`创建知识库失败: ${JSON.stringify(error)}`)
  }

  const result = await response.json()
  kbId = result.data.id

  console.log(`✅ 知识库创建成功`)
  console.log(`  知识库ID: ${kbId}`)
  console.log(`  标题: ${result.data.title}`)
  return result
}

// ==================== 文档上传 ====================

async function uploadDocument(filePath: string) {
  console.log('\n📤 上传文档...')
  console.log(`  文件: ${filePath}`)
  console.log(`  知识库ID: ${kbId}`)

  const fileBuffer = readFileSync(filePath)
  const blob = new Blob([fileBuffer], { type: 'application/pdf' })

  const formData = new FormData()
  formData.append('file', blob, 'test.pdf')
  formData.append('kb_id', kbId)
  formData.append('autoProcess', 'true')

  const response = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    headers: {
      'Cookie': cookies,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`上传失败: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  const doc = result.data.document
  const docId = doc.id

  console.log(`✅ 上传成功！`)
  console.log(`  文档ID: ${docId}`)
  console.log(`  状态: ${doc.status}`)
  console.log(`  自动处理: ${result.data.autoProcessTriggered}`)

  return docId
}

async function waitForDocumentProcessing(docId: string, maxWait: number = 300000) {
  console.log('\n⏳ 等待文档处理完成（最长5分钟）...')

  const startTime = Date.now()
  let lastStatus = ''
  let checkCount = 0

  while (Date.now() - startTime < maxWait) {
    checkCount++

    const response = await fetch(
      `${API_BASE}/api/documents?kb_id=${kbId}`,
      {
        headers: {
          'Cookie': cookies,
        },
      }
    )

    if (!response.ok) {
      console.log(`  ⚠️  查询失败 (${response.status}), 重试中...`)
      await new Promise(resolve => setTimeout(resolve, 3000))
      continue
    }

    const result = await response.json()
    const documents = result.data
    const doc = documents.find((d: any) => d.id === docId)

    if (!doc) {
      console.log(`  ⚠️  文档未找到, 重试中...`)
      await new Promise(resolve => setTimeout(resolve, 3000))
      continue
    }

    const currentStatus = doc.status

    if (currentStatus !== lastStatus) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`  [${elapsed}s] 状态: ${currentStatus}`)
      lastStatus = currentStatus
    }

    if (currentStatus === 'completed') {
      console.log('\n✅ 文档处理完成！')
      return doc
    } else if (currentStatus === 'failed') {
      console.log(`\n❌ 文档处理失败`)
      console.log(`  错误信息: ${doc.error_message || '未知错误'}`)
      throw new Error(`文档处理失败`)
    }

    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  throw new Error(`等待超时 (${maxWait / 1000}秒)`)
}

// ==================== 主流程 ====================

async function main() {
  try {
    console.log('='.repeat(70))
    console.log('📚 Context-OS 文档上传和嵌入测试')
    console.log('='.repeat(70))
    console.log(`API地址: ${API_BASE}`)
    console.log()

    // 1. 注册/登录用户
    const timestamp = Date.now()
    await registerUser(`test${timestamp}@example.com`, 'test123456')

    // 2. 创建知识库
    await createKnowledgeBase(
      '测试知识库',  // title
      '用于测试文档上传和向量嵌入功能'  // description
    )

    // 3. 上传文档
    const pdfPath = resolve(process.cwd(), 'test.pdf')
    const docId = await uploadDocument(pdfPath)

    // 4. 等待处理完成
    const doc = await waitForDocumentProcessing(docId)

    // 5. 输出结果
    console.log()
    console.log('='.repeat(70))
    console.log('📋 测试完成 - 结果汇总')
    console.log('='.repeat(70))
    console.log(`用户ID: ${userId}`)
    console.log(`知识库ID: ${kbId}`)
    console.log(`文档ID: ${docId}`)
    console.log(`文档名称: ${doc.name}`)
    console.log(`文档状态: ${doc.status}`)
    console.log(`处理模式: ${doc.chunking_mode}`)
    console.log()
    console.log('🎯 可以使用以下信息进行召回测试:')
    console.log(`   知识库ID (kb_id): ${kbId}`)
    console.log(`   文档ID (doc_id): ${docId}`)
    console.log()

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
