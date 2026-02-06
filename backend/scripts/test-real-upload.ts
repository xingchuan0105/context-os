#!/usr/bin/env tsx
/**
 * 真实文档上传测试
 * 测试完整的 BullMQ Worker 流水线
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

// 创建队列
const ingestQueue = new Queue('ingest', { connection: new Redis(redisConnection) })

/**
 * 上传文件到 Supabase Storage
 */
async function uploadFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const filePath = `test/${Date.now()}-${fileName}`

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`上传失败: ${error.message}`)
  }

  console.log(`✅ 文件已上传: ${filePath}`)
  return filePath
}

/**
 * 创建文档记录并添加到队列
 */
async function createDocumentJob(filePath: string, fileName: string, userId: string, kbId: string): Promise<string> {
  // 创建文档记录
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      kb_id: kbId,
      file_name: fileName,
      storage_path: filePath,
      status: 'processing',
    })
    .select('id')

  if (docError) {
    throw new Error(`创建文档记录失败: ${docError.message}`)
  }

  if (!doc || doc.length === 0) {
    throw new Error('创建文档记录失败: 未返回文档 ID')
  }

  const docId = doc[0].id

  // 添加到队列
  await ingestQueue.add(
    'ingest-document',
    {
      doc_id: docId,
      storage_path: filePath,
      kb_id: kbId,
      user_id: userId,
    },
    {
      jobId: `doc-${docId}`,
      priority: 1,
    }
  )

  console.log(`✅ 文档记录已创建: ${docId}`)
  console.log(`✅ 任务已添加到队列`)

  return docId
}

/**
 * 监听文档状态变化
 */
async function waitForCompletion(docId: string, timeout = 300000): Promise<any> {
  const startTime = Date.now()
  const pubClient = new Redis(redisConnection)
  const channel = `doc:${docId}:progress`

  console.log(`\n⏳ 等待文档处理完成...`)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.unsubscribe()
      pubClient.disconnect()
      reject(new Error('处理超时'))
    }, timeout)

    const sub = new Redis(redisConnection)
    sub.subscribe(channel, (err) => {
      if (err) {
        clearTimeout(timer)
        reject(err)
      }
    })

    sub.on('message', (channel, message) => {
      const data = JSON.parse(message)

      if (data.stage === 'completed') {
        clearTimeout(timer)
        sub.unsubscribe()
        pubClient.disconnect()
        console.log(`\n✅ 处理完成!`)
        resolve(data)
      } else if (data.stage === 'failed') {
        clearTimeout(timer)
        sub.unsubscribe()
        pubClient.disconnect()
        reject(new Error(`处理失败: ${data.message}`))
      } else {
        // 显示进度
        const progress = data.progress ? ` (${data.progress}%)` : ''
        process.stdout.write(`\r   [${data.stage}]${progress}...`)
      }
    })
  })
}

/**
 * 获取最终文档结果
 */
async function getDocumentResult(docId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single()

  if (error) {
    throw new Error(`获取文档结果失败: ${error.message}`)
  }

  return data
}

/**
 * 获取或创建知识库
 */
async function getKnowledgeBase(userId: string): Promise<{ kbId: string; userId: string }> {
  // 查找该用户的第一个知识库
  const { data: kbs } = await supabase
    .from('knowledge_bases')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (kbs && kbs.length > 0) {
    return { kbId: kbs[0].id, userId }
  }

  // 创建新的知识库
  const { data: newKb } = await supabase
    .from('knowledge_bases')
    .insert({
      title: 'Test Knowledge Base',
      user_id: userId,
    })
    .select('id')
    .single()

  return { kbId: newKb?.id || '', userId }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                   真实文档上传测试                                   ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  // 测试用户 ID - 使用有效的 UUID
  const userId = 'eac2b544-7f81-4620-a30e-c1e3b70e53e6'
  const { kbId, userId: validUserId } = await getKnowledgeBase(userId)
  console.log(`\n👤 测试用户 ID: ${validUserId}`)
  console.log(`📚 知识库 ID: ${kbId}`)

  // 创建一个测试文档
  const testContent = `
# K-Type 认知处理流程测试文档

## 引言

本文档用于测试 Context OS 的 K-Type 认知处理流水线。该流水线基于 Dify 的 Parent-child-HQ 工作流设计，实现了文档的智能解析、分块、认知分析和向量嵌入。

## 技术架构

### 1. 文档解析
支持多种格式：
- PDF: 使用 unpdf 库解析
- DOCX: 使用 mammoth 库解析
- TXT/MD: 直接读取文本内容
- 网页: 使用 Jina Reader 提取内容

### 2. 父子分块
- 父块大小: 1024 tokens
- 子块大小: 256 tokens
- 支持去重和清理多余空格

### 3. K-Type 认知分析 (快速模式)
使用 SiliconFlow DeepSeek-V3 Pro 模型，单次 LLM 调用完成：
- 分类评分 (5维度)
- DIKW 扫描
- 知识模块提取
- 执行摘要生成
- 内容蒸馏

### 4. 向量嵌入
使用 BAAI/bge-m3 模型生成 1024 维向量。

## 预期结果

该文档应该被分类为：
- Conceptual (概念性): 8-9分
- Systemic (系统性): 7-8分
- Reasoning (推理性): 6-7分

因为文档主要描述了技术架构和实现细节。
`.trim()

  console.log(`\n📄 准备测试文档 (${testContent.length} 字符)`)

  try {
    // 1. 上传文档
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('步骤 1: 上传文档到 Supabase Storage')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const filePath = await uploadFile(
      Buffer.from(testContent),
      'k-type-test.txt',
      'text/plain'
    )

    // 2. 创建文档记录并添加到队列
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('步骤 2: 创建文档记录并添加到队列')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const docId = await createDocumentJob(filePath, 'k-type-test.txt', validUserId, kbId)
    console.log(`   文档 ID: ${docId}`)

    // 3. 等待处理完成
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('步骤 3: Worker 处理 (实时进度)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    await waitForCompletion(docId, 180000) // 3分钟超时

    // 4. 获取结果
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('步骤 4: 获取处理结果')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const result = await getDocumentResult(docId)

    console.log(`\n📊 最终状态: ${result.status}`)

    if (result.deep_summary) {
      const { classification, scan_trace, knowledge_modules, executive_summary } = result.deep_summary

      console.log('\n🏷️  分类评分:')
      console.log(`   Procedural:  ${classification.scores.procedural}/10`)
      console.log(`   Conceptual:  ${classification.scores.conceptual}/10`)
      console.log(`   Reasoning:   ${classification.scores.reasoning}/10`)
      console.log(`   Systemic:    ${classification.scores.systemic}/10`)
      console.log(`   Narrative:    ${classification.scores.narrative}/10`)
      console.log(`   主导类型: ${classification.dominantType.join(', ')}`)

      console.log('\n🔍 DIKW 扫描:')
      console.log(`   层级: ${scan_trace.dikw_level}`)
      console.log(`   模式: ${scan_trace.logic_pattern}`)

      console.log(`\n🧠 知识模块: ${knowledge_modules.length} 个`)
      console.log(`\n📝 执行摘要:`)
      console.log(`   ${executive_summary.substring(0, 100)}...`)
    }

    // 5. 获取 chunk 统计
    const { data: chunks, count } = await supabase
      .from('document_chunks')
      .select('id, is_parent', { count: 'exact' })
      .eq('doc_id', docId)

    console.log(`\n📦 分块统计:`)
    console.log(`   总块数: ${count || 0}`)

    if (chunks) {
      const parentCount = chunks.filter(c => c.is_parent).length
      const childCount = chunks.filter(c => !c.is_parent).length
      console.log(`   父块: ${parentCount}, 子块: ${childCount}`)
    }

    console.log('\n╔═══════════════════════════════════════════════════════════════╗')
    console.log('║                    ✅ 测试成功!                                  ║')
    console.log('╚═══════════════════════════════════════════════════════════════╝')

  } catch (error: any) {
    console.error(`\n❌ 测试失败: ${error.message}`)
    process.exit(1)
  } finally {
    await ingestQueue.close()
  }
}

main()
