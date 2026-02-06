/**
 * L1: 基础设施健康检查测试
 *
 * 目标: 在 30 秒内完成所有基础设施连接测试
 * - Redis 连接测试
 * - Supabase 连接测试
 * - OneAPI LLM 连接测试
 * - Embedding API 连接测试
 */

import { timer } from '../utils/timer'
import { checkMetric } from '../utils/metrics'
import { reporter } from '../reporters/console'
import Redis from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const TEST_CONFIG = {
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  oneapiBaseUrl: process.env.ONEAPI_BASE_URL || '',
  oneapiKey: process.env.ONEAPI_API_KEY || '',
  embeddingBaseUrl: process.env.EMBEDDING_BASE_URL || '',
  embeddingApiKey: process.env.EMBEDDING_API_KEY || '',
}

/**
 * 测试 Redis 连接
 */
async function testRedis(): Promise<boolean> {
  reporter.subsection('Redis 连接测试')
  reporter.indentIn()

  try {
    const duration = await timer.measure('infra.redis', async () => {
      const redis = new Redis({
        host: TEST_CONFIG.redisHost,
        port: TEST_CONFIG.redisPort,
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        lazyConnect: false,
      })

      const result = await redis.ping()
      await redis.quit()

      if (result !== 'PONG') {
        throw new Error(`Unexpected PING response: ${result}`)
      }
    })

    const metric = checkMetric('infra.redis', duration)
    reporter.metric(metric)
    reporter.indentOut()
    return true
  } catch (error: any) {
    reporter.indentOut()
    reporter.error(`Redis 连接失败: ${error.message}`)
    return false
  }
}

/**
 * 测试 Supabase 连接
 */
async function testSupabase(): Promise<boolean> {
  reporter.subsection('Supabase 连接测试')
  reporter.indentIn()

  if (!TEST_CONFIG.supabaseUrl || !TEST_CONFIG.supabaseKey) {
    reporter.indentOut()
    reporter.warning('Supabase 配置缺失，跳过测试')
    return true
  }

  try {
    const duration = await timer.measure('infra.supabase', async () => {
      const supabase = createClient(
        TEST_CONFIG.supabaseUrl,
        TEST_CONFIG.supabaseKey,
        {
          db: { schema: 'public' },
          global: {
            headers: { Connection: 'keep-alive' },
          },
        }
      )

      // 简单查询测试
      const { error } = await supabase.from('documents').select('id').limit(1)

      if (error && !error.message.includes('does not exist')) {
        throw new Error(`Supabase query failed: ${error.message}`)
      }
    })

    const metric = checkMetric('infra.supabase', duration)
    reporter.metric(metric)
    reporter.indentOut()
    return true
  } catch (error: any) {
    reporter.indentOut()
    reporter.error(`Supabase 连接失败: ${error.message}`)
    return false
  }
}

/**
 * 测试 OneAPI LLM 连接
 */
async function testOneAPI(): Promise<boolean> {
  reporter.subsection('OneAPI LLM 连接测试')
  reporter.indentIn()

  if (!TEST_CONFIG.oneapiBaseUrl || !TEST_CONFIG.oneapiKey) {
    reporter.indentOut()
    reporter.warning('OneAPI 配置缺失，跳过测试')
    return true
  }

  try {
    const duration = await timer.measure('infra.oneapi', async () => {
      const client = new OpenAI({
        baseURL: TEST_CONFIG.oneapiBaseUrl,
        apiKey: TEST_CONFIG.oneapiKey,
      })

      // 发送一个简单的测试请求
      const response = await client.chat.completions.create({
        model: process.env.ONEAPI_MODEL || 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      })

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response from LLM')
      }
    })

    const metric = checkMetric('infra.oneapi', duration)
    reporter.metric(metric)
    reporter.indentOut()
    return true
  } catch (error: any) {
    reporter.indentOut()
    reporter.error(`OneAPI 连接失败: ${error.message}`)
    return false
  }
}

/**
 * 测试 Embedding API 连接
 */
async function testEmbedding(): Promise<boolean> {
  reporter.subsection('Embedding API 连接测试')
  reporter.indentIn()

  if (!TEST_CONFIG.embeddingBaseUrl || !TEST_CONFIG.embeddingApiKey) {
    reporter.indentOut()
    reporter.warning('Embedding API 配置缺失，跳过测试')
    return true
  }

  try {
    const duration = await timer.measure('infra.embedding', async () => {
      const client = new OpenAI({
        baseURL: TEST_CONFIG.embeddingBaseUrl,
        apiKey: TEST_CONFIG.embeddingApiKey,
      })

      // 发送一个简单的 embedding 请求
      const response = await client.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'BAAI/bge-m3',
        input: 'test',
      })

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding response')
      }

      const embedding = response.data[0].embedding
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding format')
      }

      reporter.info(`Embedding 维度: ${embedding.length}`)
    })

    const metric = checkMetric('infra.embedding', duration)
    reporter.metric(metric)
    reporter.indentOut()
    return true
  } catch (error: any) {
    reporter.indentOut()
    reporter.error(`Embedding API 连接失败: ${error.message}`)
    return false
  }
}

/**
 * 运行所有基础设施测试
 */
export async function runInfrastructureTests(): Promise<boolean> {
  reporter.title('基础设施健康检查 (L1)')

  const results: boolean[] = []

  // Redis 测试
  results.push(await testRedis())

  // Supabase 测试
  results.push(await testSupabase())

  // OneAPI 测试
  results.push(await testOneAPI())

  // Embedding API 测试
  results.push(await testEmbedding())

  const allPassed = results.every(r => r)

  reporter.summary([
    {
      name: '基础设施检查',
      status: allPassed ? 'pass' : 'fail',
      duration: 0,
    },
  ])

  return allPassed
}
