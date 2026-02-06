/**
 * 测试统一 OneAPI 配置
 *
 * 验证所有模型都通过 OneAPI 调用
 */

// 加载环境变量
import { config } from 'dotenv'
config()

import { createLLMClient } from '../lib/llm-client'

// 测试提示词
const TEST_PROMPT = '用一句话介绍你自己，不超过20个字。'

/**
 * 测试单个配置
 */
async function testConfig(modelKey: string) {
  console.log(`\n🔄 测试配置: ${modelKey}`)
  console.log('─'.repeat(60))

  try {
    const client = createLLMClient(modelKey)
    const config = client.getConfig()

    console.log(`   模型名称: ${config.name}`)
    console.log(`   模型 ID: ${config.model}`)
    console.log(`   Base URL: ${config.baseURL}`)
    console.log(`   API Key: ${config.apiKey.substring(0, 15)}...`)

    // 验证是否使用 OneAPI
    if (!config.baseURL.includes('localhost:3000') && !config.baseURL.includes('oneapi')) {
      console.log(`   ⚠️  警告: 未检测到 OneAPI 网关`)
      return false
    }

    // 测试调用
    const startTime = Date.now()
    const { content } = await client.chat([
      { role: 'user', content: TEST_PROMPT }
    ])
    const duration = Date.now() - startTime

    console.log(`   ✅ 成功: ${(duration / 1000).toFixed(2)}s`)
    console.log(`   📝 回复: ${content.trim()}`)

    return true

  } catch (error: any) {
    console.log(`   ❌ 失败: ${error.message}`)
    return false
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     测试统一 OneAPI 配置                                    ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  // 要测试的配置
  const configs = [
    'default',                    // 默认配置
    'deepseek_chat',              // DeepSeek Chat
    'deepseek_reasoner',          // DeepSeek Reasoner
    'deepseek_v32_pro',           // DeepSeek V3.2 Pro
    'qwen_max',                   // Qwen Max
    'qwen_flash',                 // Qwen Flash
    // 兼容性别名
    'oneapi',
    'oneapi_deepseek',
    'oneapi_qwen_max',
  ]

  let successCount = 0
  let failCount = 0

  for (const configKey of configs) {
    const success = await testConfig(configKey)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('📊 测试汇总')
  console.log('═'.repeat(60))
  console.log(`   总计: ${configs.length} 个配置`)
  console.log(`   成功: ${successCount} 个`)
  console.log(`   失败: ${failCount} 个`)

  if (failCount === 0) {
    console.log('\n✅ 所有配置都通过 OneAPI 调用！')
    console.log('✅ 统一网关配置成功！')
  } else {
    console.log('\n⚠️  部分配置测试失败，请检查')
  }

  console.log('═'.repeat(60))
}

main()
  .then(() => {
    console.log('\n✅ 测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  })
