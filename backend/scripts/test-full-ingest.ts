// 完整 Ingest 流程测试���包括数据库写入）
// 测试 BAAI/bge-m3 (1024维) + worker 处理
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { redisConnection } from '../lib/redis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ingestQueue = new Queue('ingest', { connection: redisConnection })

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║       完整 Ingest 流程测试 (BAAI/bge-m3 + 数据库)                ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  const userId = generateUUID()
  let kbId: string | null = null
  let docId: string | null = null

  try {
    // 步骤 1: 创建测试用户（使用 admin API）
    console.log('\n📝 步骤 1: 创建测试用户...')

    const { error: adminError } = await supabase.auth.admin.createUser({
      id: userId,
      email: `test-bge-m3-${userId.slice(0, 8)}@example.com`,
      password: 'test123456',
      email_confirm: true,
      user_metadata: { full_name: 'BAAI BGE-M3 Test User' },
    })

    if (adminError && !adminError.message.includes('already exists')) {
      console.log(`   ⚠️ 创建用户失败: ${adminError.message}`)
      console.log(`   💡 提示: 请确保使用 service_role_key`)
    } else {
      console.log(`   ✅ 用户: ${userId}`)
    }

    // 步骤 2: 创建知识库
    console.log('\n📚 步骤 2: 创建知识库...')
    const { data: kb, error: kbError } = await supabase
      .from('knowledge_bases')
      .insert({
        user_id: userId,
        title: 'BAAI BGE-M3 测试知识库',
        description: '测试 BAAI/bge-m3 (1024维) 的完整 ingest 流程',
      })
      .select('id')
      .single()

    if (kbError) throw new Error(`创建知识库失败: ${kbError.message}`)
    kbId = kb.id
    console.log(`   ✅ 知识库: ${kbId}`)

    // 步骤 3: 上传测试文档
    console.log('\n📄 步骤 3: 上传测试文档...')

    const testText = `
# 人工智能完整指南

## 第一章：人工智能概述

人工智能（Artificial Intelligence，简称AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。这些任务包括学习、推理、问题解决、感知和语言理解。

### 1.1 AI 的历史

人工智能的概念可以追溯到古希腊神话中的机械人，但作为一个学科，AI 始于 1956 年的达特茅斯会议。

### 1.2 AI 的类型

人工智能可以分为三类：
- **弱人工智能（Narrow AI）**: 专注于执行特定任务的系统
- **强人工智能（General AI）**: 具有与人类相当智能水平的系统
- **超人工智能（Super AI）**: 超越人类智能的系统

## 第二章：机器学习基础

机器学习是 AI 的核心子领域，使计算机能够从数据中学习并改进性能。

### 2.1 监督学习

监督学习使用标记数据训练模型，常见算法包括线性回归、决策树、支持向量机和神经网络。

### 2.2 无监督学习

无监督学习从未标记数据中发现模式，包括聚类分析和主成分分析。

### 2.3 强化学习

强化学习通过与环境交互来学习最优策略，应用于游戏 AI 和机器人控制。

## 第三章：深度学习革命

深度学习是机器学习的子集，使用多层神经网络处理复杂问题。

### 3.1 神经网络架构

- **卷积神经网络（CNN）**: 用于图像识别和计算机视觉
- **循环神经网络（RNN）**: 适用于序列数据和时间序列分析
- **Transformer**: 彻底改变自然语言处理的革命性架构

## 第四章：AI 应用领域

1. **医疗健康**: 疾病诊断、药物研发、个性化治疗
2. **金融服务**: 欺诈检测、算法交易、信用评估
3. **交通运输**: 自动驾驶、交通优化、物流规划
4. **教育**: 个性化学习、智能辅导、自动评估

## 第五章：未来展望

人工智能将继续快速发展，但也面临技术挑战和伦理问题。
`.trim()

    const fileName = `test-bge-m3-${Date.now()}.txt`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, testText, {
        contentType: 'text/plain',
        upsert: true,
      })

    if (uploadError) throw new Error(`上传文件失败: ${uploadError.message}`)
    console.log(`   ✅ 文件已上传: ${fileName}`)

    // 步骤 4: 创建文档记录
    console.log('\n📋 步骤 4: 创建文档记录...')

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        kb_id: kbId,
        file_name: fileName,
        storage_path: filePath,
        mime_type: 'text/plain',
        file_size: testText.length,
        status: 'uploading',
      })
      .select('id')
      .single()

    if (docError) throw new Error(`创建文档记录失败: ${docError.message}`)
    docId = doc.id
    console.log(`   ✅ 文档记录: ${docId}`)

    // 步骤 5: 提交 Ingest 任务
    console.log('\n🚀 步骤 5: 提交 Ingest 任务到 Worker...')

    const job = await ingestQueue.add(
      'ingest-document',
      {
        doc_id: docId,
        storage_path: filePath,
        kb_id: kbId,
        user_id: userId,
      },
      {
        jobId: `ingest-${docId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }
    )

    console.log(`   ✅ 任务已提交: Job ID = ${job.id}`)

    // 步骤 6: 等待处理完成
    console.log('\n⏳ 步骤 6: 等待 Worker 处理...')
    console.log('   (这可能需要 1-2 分钟，请耐心等待...)')

    const startTime = Date.now()
    const timeout = 180000 // 3分钟超时

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 3000))

      const { data: currentDoc } = await supabase
        .from('documents')
        .select('status, error_message, chunks_count, deep_summary')
        .eq('id', docId)
        .single()

      if (!currentDoc) continue

      const elapsed = Math.round((Date.now() - startTime) / 1000)

      if (currentDoc.status === 'completed') {
        console.log(`   ✅ 处理完成! (耗时 ${elapsed}秒)`)

        // 获取块统计
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('id, is_parent, embedding')
          .eq('doc_id', docId)

        const parents = chunks?.filter(c => c.is_parent) || []
        const children = chunks?.filter(c => !c.is_parent) || []

        console.log(`\n📊 处理结果:`)
        console.log(`   父块数: ${parents.length}`)
        console.log(`   子块数: ${children.length}`)

        // 验证向量
        if (children.length > 0) {
          const firstChild = children[0]
          const embedding = firstChild.embedding as number[]
          console.log(`   向量维度: ${embedding?.length || 0}`)
          if (embedding && embedding.length === 1024) {
            console.log(`   ✅ 向量维度正确 (1024)`)
          } else {
            console.log(`   ⚠️ 向量维度异常，期望 1024`)
          }
        }

        // 打印认知索引
        if (currentDoc.deep_summary) {
          const summary = currentDoc.deep_summary as any
          console.log(`\n🧠 认知索引:`)
          if (summary.classification) {
            console.log(`   主导类型: ${summary.classification.dominantType?.join(', ')}`)
          }
          if (summary.knowledge_modules) {
            console.log(`   知识模块数: ${summary.knowledge_modules.length}`)
          }
        }

        console.log(`\n╔═══════════════════════════════════════════════════════════════╗`)
        console.log(`║                    ✅ 完整 Ingest 测试通过!                       ║`)
        console.log(`╚═══════════════════════════════════════════════════════════════╝`)
        break
      }

      if (currentDoc.status === 'failed') {
        console.log(`   ❌ 处理失败: ${currentDoc.error_message}`)
        break
      }

      process.stdout.write(`\r   状态: ${currentDoc.status} (${elapsed}s)`)
    }

    // 如果超时
    if (Date.now() - startTime >= timeout) {
      console.log(`\n   ⏱️ 等待超时，请检查 Worker 状态`)
      console.log(`   可以通过以下命令查询状态:`)
      console.log(`   curl http://localhost:3000/api/test/full-ingest?doc_id=${docId}`)
    }

  } catch (error) {
    console.error(`\n❌ 错误:`, error)
  } finally {
    await ingestQueue.close()
    console.log(`\n📌 测试数据保留在数据库中:`)
    console.log(`   用户ID: ${userId}`)
    console.log(`   知识库ID: ${kbId}`)
    console.log(`   文档ID: ${docId}`)
  }
}

main()
