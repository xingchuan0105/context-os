#!/usr/bin/env node
// Context OS Worker 启动脚本 (JS wrapper for dotenv loading)
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Step 1: 加载 .env.local
const envPath = resolve(__dirname, '../.env.local')
const result = config({ path: envPath })

if (result.error) {
  console.warn('Warning: .env.local not found, using system environment variables')
}

// 验证必需的环境变量
const requiredEnvs = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ONEAPI_BASE_URL',
  'ONEAPI_API_KEY',
]

const missing = requiredEnvs.filter(key => !process.env[key])
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`)
  console.error(`Please check .env.local file`)
  process.exit(1)
}

// Step 2: 动态 import worker (此时环境变量已加载)
const { ingestWorker } = await import('../lib/worker.ts')

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🧠 Context OS - Cognitive Pipeline Worker                   ║
║                                                               ║
║   复刻 Dify Parent-child-HQ 工作流                              ║
║                                                               ║
║   - 支持格式: PDF, DOCX, TXT, MD, 网页                        ║
║   - 处理流程: K-Type Scan → Classify → Audit → Creator        ║
║   - 分块策略: 父子分块 + 向量嵌入                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

[配置]
  Redis:        ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}
  Concurrency:   ${process.env.WORKER_CONCURRENCY || 2}
  Embedding:    ${process.env.EMBEDDING_MODEL || 'text-embedding-3-small'}
  LLM:          ${process.env.ONEAPI_MODEL || 'deepseek-chat'}
  API Base:     ${process.env.ONEAPI_BASE_URL}

[状态]
  Worker 已启动，等待任务...
`)

// Worker 事件监听
ingestWorker.on('ready', () => {
  console.log('✅ Worker is ready')
})

ingestWorker.on('active', (job) => {
  console.log(`🔄 Processing job ${job.id}...`)
})

ingestWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`)
})

ingestWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message)
})

ingestWorker.on('error', (err) => {
  console.error('Worker error:', err)
})

// 保持进程运行
process.on('SIGINT', async () => {
  console.log('\n\n正在关闭 Worker...')
  await ingestWorker.close()
  console.log('Worker 已关闭')
  process.exit(0)
})
