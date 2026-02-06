#!/usr/bin/env tsx
/**
 * API 健康检查脚本
 * 验证 LLM 和 Embedding API 是否可用
 */

// 先加载环境变量
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

import OpenAI from 'openai'

interface HealthCheckResult {
  name: string
  status: 'healthy' | 'unhealthy' | 'skipped'
  duration: number
  error?: string
  details?: any
}

const results: HealthCheckResult[] = []

/**
 * 检查 OneAPI LLM
 */
async function checkOneAPI(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  const apiKey = process.env.ONEAPI_API_KEY
  const baseURL = process.env.ONEAPI_BASE_URL
  const model = process.env.ONEAPI_MODEL || 'deepseek-chat'

  if (!apiKey || !baseURL) {
    return {
      name: 'OneAPI LLM',
      status: 'skipped',
      duration: 0,
      error: '配置缺失',
    }
  }

  console.log(`\n🔍 检查 OneAPI LLM...`)
  console.log(`   URL: ${baseURL}`)
  console.log(`   Model: ${model}`)
  console.log(`   API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`)

  try {
    const client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 30000, // 30 秒超时
    })

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    })

    const duration = Date.now() - startTime
    console.log(`   ✅ 健康 (${duration}ms)`)

    return {
      name: 'OneAPI LLM',
      status: 'healthy',
      duration,
      details: {
        responsePreview: response.choices[0]?.message?.content?.slice(0, 50),
      },
    }
  } catch (error: any) {
    const duration = Date.now() - startTime

    // 解析错误
    let errorMsg = error.message
    if (error.status === 401) {
      errorMsg = 'API Key 无效或过期 (401)'
    } else if (error.status === 429) {
      errorMsg = '请求频率超限 (429)'
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMsg = '网络连接失败'
    } else if (error.type === 'timeout' || error.message.includes('timeout')) {
      errorMsg = '请求超时'
    }

    console.log(`   ❌ 不健康: ${errorMsg}`)

    return {
      name: 'OneAPI LLM',
      status: 'unhealthy',
      duration,
      error: errorMsg,
    }
  }
}

/**
 * 检查 Embedding API
 */
async function checkEmbedding(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  const apiKey = process.env.EMBEDDING_API_KEY
  const baseURL = process.env.EMBEDDING_BASE_URL
  const model = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3'

  if (!apiKey || !baseURL) {
    return {
      name: 'Embedding API',
      status: 'skipped',
      duration: 0,
      error: '配置缺失',
    }
  }

  console.log(`\n🔍 检查 Embedding API...`)
  console.log(`   URL: ${baseURL}`)
  console.log(`   Model: ${model}`)
  console.log(`   API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`)

  try {
    const client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 30000, // 30 秒超时
    })

    const response = await client.embeddings.create({
      model,
      input: 'test',
    })

    const duration = Date.now() - startTime
    const dimension = response.data[0].embedding.length

    console.log(`   ✅ 健康 (${duration}ms)`)
    console.log(`   📐 向量维度: ${dimension}`)

    return {
      name: 'Embedding API',
      status: 'healthy',
      duration,
      details: { dimension },
    }
  } catch (error: any) {
    const duration = Date.now() - startTime

    // 解析错误
    let errorMsg = error.message
    if (error.status === 401) {
      errorMsg = 'API Key 无效或过期 (401)'
    } else if (error.status === 429) {
      errorMsg = '请求频率超限 (429)'
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMsg = '网络连接失败'
    } else if (error.type === 'timeout' || error.message.includes('timeout')) {
      errorMsg = '请求超时'
    }

    console.log(`   ❌ 不健康: ${errorMsg}`)

    return {
      name: 'Embedding API',
      status: 'unhealthy',
      duration,
      error: errorMsg,
    }
  }
}

/**
 * 检查 Supabase
 */
async function checkSupabase(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return {
      name: 'Supabase',
      status: 'skipped',
      duration: 0,
      error: '配置缺失',
    }
  }

  console.log(`\n🔍 检查 Supabase...`)
  console.log(`   URL: ${url}`)

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(url, key)

    const { error } = await supabase.from('documents').select('id').limit(1)

    const duration = Date.now() - startTime

    if (error && !error.message.includes('does not exist')) {
      throw error
    }

    console.log(`   ✅ 健康 (${duration}ms)`)

    return {
      name: 'Supabase',
      status: 'healthy',
      duration,
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.log(`   ❌ 不健康: ${error.message}`)

    return {
      name: 'Supabase',
      status: 'unhealthy',
      duration,
      error: error.message,
    }
  }
}

/**
 * 检查 Redis
 */
async function checkRedis(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  const host = process.env.REDIS_HOST || 'localhost'
  const port = process.env.REDIS_PORT || 6379

  console.log(`\n🔍 检查 Redis...`)
  console.log(`   Host: ${host}:${port}`)

  try {
    const { default: Redis } = await import('ioredis')
    const redis = new Redis({
      host: host as string,
      port: port as number,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      lazyConnect: false,
    })

    const result = await redis.ping()
    await redis.quit()

    const duration = Date.now() - startTime

    if (result !== 'PONG') {
      throw new Error(`Unexpected response: ${result}`)
    }

    console.log(`   ✅ 健康 (${duration}ms)`)

    return {
      name: 'Redis',
      status: 'healthy',
      duration,
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.log(`   ❌ 不健康: ${error.message}`)

    return {
      name: 'Redis',
      status: 'unhealthy',
      duration,
      error: error.message,
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🏥 Context OS - API 健康检查                                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝`)

  // 检查各服务
  results.push(await checkSupabase())
  results.push(await checkRedis())
  results.push(await checkOneAPI())
  results.push(await checkEmbedding())

  // 汇总报告
  const healthy = results.filter(r => r.status === 'healthy').length
  const unhealthy = results.filter(r => r.status === 'unhealthy').length
  const skipped = results.filter(r => r.status === 'skipped').length

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                         健康检查报告                              ║
╠═══════════════════════════════════════════════════════════════╣`)

  for (const result of results) {
    const icon = result.status === 'healthy' ? '✅' : result.status === 'unhealthy' ? '❌' : '⏭️ '
    const status = result.status === 'healthy' ? '健康' : result.status === 'unhealthy' ? '不健康' : '跳过'
    const duration = result.duration > 0 ? ` (${result.duration}ms)` : ''

    console.log(`║ ${icon} ${result.name.padEnd(20)} ${status.padEnd(10)}${duration.padStart(10)} ║`)

    if (result.error) {
      console.log(`║    └─ ${result.error.padEnd(62)} ║`)
    }
    if (result.details) {
      if (result.details.dimension) {
        console.log(`║    └─ 向量维度: ${result.details.dimension}`.padEnd(67) + ' ║')
      }
    }
  }

  console.log(`╠═══════════════════════════════════════════════════════════════╣`)
  console.log(`║ 总计: ${results.length}  |  健康: ${healthy}  |  不健康: ${unhealthy}  |  跳过: ${skipped}       ║`)
  console.log(`╚═══════════════════════════════════════════════════════════════╝`)

  // 返回退出码
  if (unhealthy > 0) {
    console.log(`\n⚠️  发现 ${unhealthy} 个不健康的服务，请检查配置`)
    process.exit(1)
  } else if (skipped > 0) {
    console.log(`\n⚠️  ${skipped} 个服务被跳过（配置缺失）`)
  } else {
    console.log(`\n✅ 所有服务健康！`)
  }

  process.exit(0)
}

main()
