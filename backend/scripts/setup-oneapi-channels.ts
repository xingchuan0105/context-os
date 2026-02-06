/**
 * OneAPI 渠道自动配置脚本
 *
 * 此脚本会自动在本地 OneAPI 中配置所有需要的模型渠道
 */

const BASE_URL = 'http://localhost:3000'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-your-deepseek-api-key-here'
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-your-dashscope-api-key-here'
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || 'sk-your-siliconflow-api-key-here'

// 渠道配置
const CHANNELS = [
  {
    name: 'DeepSeek-Chat',
    type: 1, // OpenAI
    key: DEEPSEEK_API_KEY,
    base_url: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat'],
  },
  {
    name: 'DeepSeek-Reasoner',
    type: 1, // OpenAI
    key: DEEPSEEK_API_KEY,
    base_url: 'https://api.deepseek.com/v1',
    models: ['deepseek-reasoner'],
  },
  {
    name: 'Qwen-Max',
    type: 1, // OpenAI
    key: DASHSCOPE_API_KEY,
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max'],
  },
  {
    name: 'Qwen-Flash',
    type: 1, // OpenAI
    key: DASHSCOPE_API_KEY,
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-flash'],
  },
  {
    name: 'SiliconFlow-DeepSeek-V3.2',
    type: 1, // OpenAI
    key: SILICONFLOW_API_KEY,
    base_url: 'https://api.siliconflow.cn/v1',
    models: ['Pro/deepseek-ai/DeepSeek-V3.2'],
    // 注意：SiliconFlow 的完整 URL 是 /v1/chat/completions，但 OneAPI 会自动处理
  },
]

async function main() {
  console.log('🚀 OneAPI 渠道配置脚本\n')

  // 第一步：提示用户登录
  console.log('📋 步骤 1: 登录 OneAPI')
  console.log('请先访问 http://localhost:3000 并使用管理员账号登录')
  console.log('默认账号：用户名 root，密码 123456\n')

  // 由于 OneAPI 需要通过 Web UI 登录获取 token，我们使用另一种方式
  // 直接提供 curl 命令让用户手动执行，或者提供详细的配置说明

  console.log('═══════════════════════════════════════════════════════')
  console.log('📝 手动配置说明')
  console.log('═══════════════════════════════════════════════════════\n')

  CHANNELS.forEach((channel, index) => {
    console.log(`📍 渠道 ${index + 1}: ${channel.name}`)
    console.log('────────────────────────────────────────────────────')
    console.log(`  类型: OpenAI`)
    console.log(`  Base URL: ${channel.base_url}`)
    console.log(`  密钥: ${channel.key}`)
    console.log(`  模型: ${channel.models.join(', ')}`)
    console.log(`  重定向: ❌ 取消勾选`)
    console.log(`  状态: ✅ 启用`)
    console.log('')
  })

  console.log('═══════════════════════════════════════════════════════')
  console.log('🔧 配置步骤:')
  console.log('═══════════════════════════════════════════════════════')
  console.log('1. 访问 http://localhost:3000')
  console.log('2. 登录管理员账号（root / 123456）')
  console.log('3. 进入左侧菜单 "渠道"')
  console.log('4. 点击 "新建渠道" 按钮')
  console.log('5. 按照上面的配置逐个添加渠道')
  console.log('6. 添加完成后，进入 "令牌" 页面')
  console.log('7. 点击 "新建令牌"')
  console.log('8. 输入名称（如：context-os-dev）')
  console.log('9. 设置额度（建议：500000）')
  console.log('10. 复制生成的令牌（sk-开头）')
  console.log('11. 将令牌填写到 .env 文件的 ONEAPI_API_KEY')
  console.log('')

  console.log('═══════════════════════════════════════════════════════')
  console.log('📋 快速复制配置')
  console.log('═══════════════════════════════════════════════════════\n')

  // 生成 JSON 格式的配置，方便导入
  console.log('JSON 配置（可用于 OneAPI 批量导入）:\n')
  console.log(JSON.stringify(CHANNELS, null, 2))
  console.log('')
}

main()
