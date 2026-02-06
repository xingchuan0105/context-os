/**
 * 测试 Embedding API 连接
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import embeddingClient from '../lib/embedding'

// 加载环境变量
const envPath = resolve(process.cwd(), '.env')
config({ path: envPath })

async function testEmbedding() {
  console.log('🔍 测试 Embedding API 连接...\n')

  console.log('配置信息：')
  console.log(`  LITELLM_BASE_URL: ${process.env.LITELLM_BASE_URL}`)
  console.log(`  LITELLM_API_KEY: ${process.env.LITELLM_API_KEY ? '已配置' : '未配置'}`)
  console.log(`  SILICONFLOW_API_KEY: ${process.env.SILICONFLOW_API_KEY ? '已配置' : '未配置'}`)
  console.log(`  EMBEDDING_MODEL: ${process.env.EMBEDDING_MODEL}`)
  console.log('')

  try {
    console.log('调用 Embedding API...')
    const startTime = Date.now()

    const response = await embeddingClient.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b',
      input: ['测试文本'],
    })

    const duration = Date.now() - startTime

    console.log('\n✅ Embedding API 调用成功！')
    console.log(`  耗时: ${duration}ms`)
    console.log(`  向量维度: ${response.data[0].embedding.length}`)
    console.log(`  数据预览: ${response.data[0].embedding.slice(0, 5)}...`)

  } catch (error: any) {
    console.error('\n❌ Embedding API 调用失败！')
    console.error(`  错误: ${error.message}`)

    if (error.response) {
      console.error(`  状态码: ${error.response.status}`)
      console.error(`  响应: ${JSON.stringify(error.response.data)}`)
    }

    process.exit(1)
  }
}

testEmbedding()
