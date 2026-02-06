/**
 * OneAPI 配置快速参考
 */

console.log('╔════════════════════════════════════════════════════════════╗')
console.log('║          OneAPI 渠道配置 - 快速参考卡                      ║')
console.log('╚════════════════════════════════════════════════════════════╝')
console.log('')

console.log('🌐 OneAPI 管理后台: http://localhost:3000')
console.log('🔑 管理员账号: root / 123456')
console.log('')

console.log('════════════════════════════════════════════════════════════')
console.log('📋 5 个渠道配置')
console.log('════════════════════════════════════════════════════════════')
console.log('')

const channels = [
  {
    name: 'DeepSeek-Chat',
    url: 'https://api.deepseek.com/v1',
    key: 'sk-xxxx...xxxx',
    models: ['deepseek-chat'],
  },
  {
    name: 'DeepSeek-Reasoner',
    url: 'https://api.deepseek.com/v1',
    key: 'sk-xxxx...xxxx',
    models: ['deepseek-reasoner'],
  },
  {
    name: 'Qwen-Max',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    key: 'sk-xxxx...xxxx',
    models: ['qwen-max'],
  },
  {
    name: 'Qwen-Flash',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    key: 'sk-xxxx...xxxx',
    models: ['qwen-flash'],
  },
  {
    name: 'SiliconFlow-V3.2',
    url: 'https://api.siliconflow.cn/v1',
    key: 'sk-xxxx...xxxx',
    models: ['Pro/deepseek-ai/DeepSeek-V3.2'],
  },
]

channels.forEach((ch, i) => {
  console.log(`${i + 1}. ${ch.name}`)
  console.log(`   类型: OpenAI`)
  console.log(`   URL:  ${ch.url}`)
  console.log(`   Key: ${ch.key}`)
  console.log(`   模型: ${ch.models.join(', ')}`)
  console.log('')
})

console.log('════════════════════════════════════════════════════════════')
console.log('🔧 完整 API Key (复制使用)')
console.log('════════════════════════════════════════════════════════════')
console.log('')

const keys = [
  { name: 'DeepSeek', key: 'sk-your-deepseek-api-key-here' },
  { name: 'Qwen', key: 'sk-your-dashscope-api-key-here' },
  { name: 'SiliconFlow', key: 'sk-your-siliconflow-api-key-here' },
]

keys.forEach(k => {
  console.log(`${k.name}:`)
  console.log(`  ${k.key}`)
  console.log('')
})

console.log('════════════════════════════════════════════════════════════')
console.log('📝 配置步骤')
console.log('════════════════════════════════════════════════════════════')
console.log('1. 访问 http://localhost:3000')
console.log('2. 登录 (root / 123456)')
console.log('3. 进入"渠道"，逐个添加上面的 5 个渠道')
console.log('4. 进入"令牌"，创建新令牌，复制 sk-xxx')
console.log('5. 编辑 .env 文件，填写 ONEAPI_API_KEY')
console.log('6. 运行测试: npx tsx scripts/test-oneapi-setup.ts')
console.log('')

console.log('════════════════════════════════════════════════════════════')
console.log('💻 代码使用')
console.log('════════════════════════════════════════════════════════════')
console.log('')

const codeExamples = [
  { name: 'DeepSeek Chat', key: 'oneapi_deepseek_chat' },
  { name: 'DeepSeek Reasoner', key: 'oneapi_deepseek_reasoner' },
  { name: 'DeepSeek V3.2 Pro', key: 'oneapi_deepseek_v32_pro' },
  { name: 'Qwen Max', key: 'oneapi_qwen_max' },
  { name: 'Qwen Flash', key: 'oneapi_qwen_flash' },
]

codeExamples.forEach(ex => {
  console.log(`// ${ex.name}`)
  console.log(`const ${ex.key.replace('oneapi_', '')} = createLLMClient('${ex.key}')`)
  console.log('')
})

console.log('════════════════════════════════════════════════════════════')
console.log('📚 详细文档: docs/ONEAPI_CHANNELS_CONFIG.md')
console.log('════════════════════════════════════════════════════════════')
