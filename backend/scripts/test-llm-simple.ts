/**
 * 简单的 LLM API 测试脚本
 * 用于测试各种模型配置是否正常工作
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createLLMClient, MODEL_CONFIGS } from '../lib/llm-client.js'

// 加载环境变量
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

async function testLLM() {
  console.log('🔬 LLM API 测试')
  console.log('=====================================\n')

  // 测试简单问题
  const testPrompt = '你好，请用一句话介绍你自己。'
  const messages = [
    { role: 'system', content: '你是一个有用的助手。' },
    { role: 'user', content: testPrompt }
  ]

  // 测试配置
  const tests = [
    {
      name: 'DeepSeek 直连 (默认配置)',
      modelKey: 'oneapi', // 使用 .env 中的 ONEAPI 配置
      description: `Base URL: ${process.env.ONEAPI_BASE_URL}\nModel: ${process.env.ONEAPI_MODEL}`
    },
    {
      name: 'DeepSeek 直连 (hardcoded)',
      modelKey: 'deepseek',
      description: 'Base URL: https://api.deepseek.com/v1\nModel: deepseek-chat'
    },
    {
      name: 'SiliconFlow DeepSeek-V3',
      modelKey: 'siliconflow_deepseek',
      description: 'Base URL: https://api.siliconflow.cn/v1\nModel: deepseek-ai/DeepSeek-V3'
    }
  ]

  for (const test of tests) {
    console.log(`\n📋 测试: ${test.name}`)
    console.log(`   ${test.description}`)
    console.log(`   ─────────────────────────────────────`)

    try {
      const startTime = Date.now()
      const client = createLLMClient(test.modelKey as any)
      const config = client.getConfig()

      console.log(`   实际配置:`)
      console.log(`   - Base URL: ${config.baseURL}`)
      console.log(`   - Model: ${config.model}`)
      console.log(`   - API Key: ${config.apiKey ? config.apiKey.slice(0, 10) + '...' : '未设置'}`)
      console.log(`   - Timeout: ${config.timeout}ms`)

      console.log(`\n   发送请求: "${testPrompt}"`)

      const { content, duration } = await client.chat(messages, {
        temperature: 0.7,
        maxTokens: 100
      })

      const elapsed = Date.now() - startTime

      console.log(`\n   ✅ 成功!`)
      console.log(`   ⏱️  耗时: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`)
      console.log(`   📝 回复: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`)

    } catch (error: any) {
      console.log(`\n   ❌ 失败!`)
      console.log(`   错误: ${error.message}`)

      // 打印更多错误详情
      if (error.cause) {
        console.log(`   Cause: ${error.cause}`)
      }
      if (error.code) {
        console.log(`   Code: ${error.code}`)
      }
      if (error.status) {
        console.log(`   Status: ${error.status}`)
      }
    }
  }

  console.log('\n=====================================')
  console.log('测试完成!\n')
}

testLLM()
