/**
 * OneAPI 配置测试脚本
 *
 * 功能：
 * 1. 测试本地 OneAPI 连接
 * 2. 测试不同模型的调用
 * 3. 验证配置是否正确
 *
 * 使用方法：
 *   1. 确保 OneAPI 已启动: docker-compose -f docker-compose.oneapi.yml up -d
 *   2. 配置环境变量: 复制 .env.example 到 .env 并填写配置
 *   3. 运行测试: npx tsx scripts/test-oneapi-setup.ts
 */

// 加载环境变量
import { config } from 'dotenv'
config()

import { createLLMClient, compareModels } from '../lib/llm-client'

// 测试提示词
const TEST_PROMPT = '用一句话介绍你自己，不超过20个字。'

/**
 * 测试单个模型配置
 */
async function testSingleModel(modelKey: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🧪 测试模型配置: ${modelKey}`)
  console.log('='.repeat(60))

  try {
    const client = createLLMClient(modelKey)
    const config = client.getConfig()

    console.log(`\n📋 配置信息:`)
    console.log(`   名称: ${config.name}`)
    console.log(`   Base URL: ${config.baseURL}`)
    console.log(`   模型: ${config.model}`)
    console.log(`   API Key: ${config.apiKey ? '已配置 (' + config.apiKey.slice(0, 10) + '...)' : '❌ 未配置'}`)

    if (!config.apiKey) {
      console.log(`\n❌ 失败: API Key 未配置`)
      return false
    }

    console.log(`\n🔄 发送测试请求...`)

    const startTime = Date.now()
    const { content, duration } = await client.chat([
      { role: 'user', content: TEST_PROMPT }
    ], {
      temperature: 0.7,
      maxTokens: 100,
    })

    const endTime = Date.now()

    console.log(`\n✅ 成功!`)
    console.log(`   耗时: ${duration}ms`)
    console.log(`   响应: ${content}`)
    console.log(`   实际耗时: ${endTime - startTime}ms`)

    return true

  } catch (error: any) {
    console.log(`\n❌ 失败: ${error.message}`)
    if (error.response?.data) {
      console.log(`   错误详情:`, error.response.data)
    }
    return false
  }
}

/**
 * 测试多个模型对比
 */
async function testModelComparison() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔀 多模型对比测试`)
  console.log('='.repeat(60))

  const modelsToTest = [
    'oneapi_deepseek',
    'oneapi_qwen_plus',
  ] as const

  try {
    const results = await compareModels(
      TEST_PROMPT,
      modelsToTest,
      {
        useStream: false,
        temperature: 0.7,
        systemPrompt: '你是一个简洁的助手。',
      }
    )

    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 测试结果汇总`)
    console.log('='.repeat(60))

    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.model}`)
      if (result.error) {
        console.log(`   ❌ 失败: ${result.error}`)
      } else {
        console.log(`   ✅ 成功 (${(result.duration / 1000).toFixed(2)}s)`)
        console.log(`   响应: ${result.content}`)
      }
    })

  } catch (error: any) {
    console.log(`\n❌ 对比测试失败: ${error.message}`)
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🚀 OneAPI 配置测试`)
  console.log('='.repeat(60))
  console.log(`\n📝 测试提示词: "${TEST_PROMPT}"`)

  // 读取环境变量
  const oneapiBaseUrl = process.env.ONEAPI_BASE_URL || 'http://localhost:3000/v1'
  const oneapiKey = process.env.ONEAPI_API_KEY || ''

  console.log(`\n🔧 环境配置:`)
  console.log(`   ONEAPI_BASE_URL: ${oneapiBaseUrl}`)
  console.log(`   ONEAPI_API_KEY: ${oneapiKey ? '已配置 (' + oneapiKey.slice(0, 10) + '...)' : '❌ 未配置'}`)

  if (!oneapiKey) {
    console.log(`\n❌ 错误: 未配置 ONEAPI_API_KEY 环境变量`)
    console.log(`\n💡 提示:`)
    console.log(`   1. 确保 OneAPI 已启动: docker-compose -f docker-compose.oneapi.yml up -d`)
    console.log(`   2. 访问 http://localhost:3000 初始化并创建令牌`)
    console.log(`   3. 复制 .env.example 到 .env 并填写 ONEAPI_API_KEY`)
    return
  }

  // 测试默认配置
  console.log(`\n\n${'='.repeat(60)}`)
  console.log(`📌 第一步: 测试默认 OneAPI 配置`)
  console.log('='.repeat(60))

  const defaultSuccess = await testSingleModel('oneapi')

  if (!defaultSuccess) {
    console.log(`\n\n⚠️  默认配置测试失败，跳过后续测试`)
    return
  }

  // 测试各个模型
  const models = [
    'oneapi_deepseek',
    'oneapi_qwen_max',
    'oneapi_qwen_plus',
  ]

  let successCount = 0
  for (const model of models) {
    const success = await testSingleModel(model)
    if (success) successCount++
  }

  // 汇总
  console.log(`\n\n${'='.repeat(60)}`)
  console.log(`📊 测试汇总`)
  console.log('='.repeat(60))
  console.log(`   总计: ${models.length + 1} 个配置`)
  console.log(`   成功: ${successCount + 1} 个`)
  console.log(`   失败: ${models.length - successCount} 个`)

  if (successCount === models.length) {
    console.log(`\n✅ 所有测试通过! OneAPI 配置正确。`)
  } else {
    console.log(`\n⚠️  部分测试失败，请检查:`)
    console.log(`   1. OneAPI 管理后台是否配置了对应的渠道`)
    console.log(`   2. 渠道的模型名称是否与代码中的配置一致`)
    console.log(`   3. 渠道的 API Key 是否正确`)
  }
}

// 运行测试
main().catch(error => {
  console.error(`\n❌ 测试脚本执行失败:`, error)
  process.exit(1)
})
