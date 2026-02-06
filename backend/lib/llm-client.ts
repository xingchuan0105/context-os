import { createClient } from './llm'
import OpenAI from 'openai'
import { incrementCounter, recordTiming } from './observability/metrics'

export type StreamEvent =
  | { type: 'start'; timestamp: number }
  | { type: 'delta'; content: string; timestamp: number }
  | { type: 'rate_limit'; info: string; timestamp: number }
  | { type: 'error'; error: string; timestamp: number }
  | { type: 'end'; timestamp: number; fullContent: string; metrics: StreamMetrics }

export interface StreamMetrics {
  totalDuration: number
  firstTokenTime: number
  tokenCount: number
  tokensPerSecond: number
  rateLimitDetected: boolean
  rateLimitEvents: string[]
  avgChunkInterval: number
}

export interface ModelConfig {
  name: string
  model: string
  timeout?: number
  apiKey?: string
}

export function getModelConfigs(): Record<string, ModelConfig> {
  const createConfig = (
    model: string,
    envKey?: string,
    name?: string,
    timeout: number = 5 * 60 * 1000
  ): ModelConfig => ({
    name: name || `LiteLLM - ${model}`,
    model: envKey ? process.env[envKey] || model : model,
    timeout,
    apiKey: process.env.LITELLM_API_KEY || undefined,
  })

  const models: Record<string, { model: string; envKey?: string; name?: string }> = {
    default: {
      model: 'deepseek-chat',
      envKey: 'DEEPSEEK_CHAT_MODEL',
      name: 'LiteLLM - Default (DeepSeek Chat)',
    },
    deepseek_chat: {
      model: 'deepseek-chat',
      envKey: 'DEEPSEEK_CHAT_MODEL',
      name: 'LiteLLM - DeepSeek Chat',
    },
    deepseek_v32: {
      model: 'Pro/deepseek-ai/DeepSeek-V3.2',
      envKey: 'DEEPSEEK_V32_MODEL',
      name: 'LiteLLM - DeepSeek V3.2',
    },
    deepseek_reasoner: {
      model: 'deepseek-reasoner',
      envKey: 'DEEPSEEK_REASONER_MODEL',
      name: 'LiteLLM - DeepSeek Reasoner',
    },
    qwen_max: {
      model: 'qwen-max',
      envKey: 'QWEN_MAX_MODEL',
      name: 'LiteLLM - Qwen Max',
    },
    qwen_flash: {
      model: 'qwen-flash',
      envKey: 'QWEN_FLASH_MODEL',
      name: 'LiteLLM - Qwen Flash',
    },
  }

  const configs: Record<string, ModelConfig> = {}
  for (const [key, def] of Object.entries(models)) {
    configs[key] = createConfig(def.model, def.envKey, def.name)
  }

  const aliases: Record<string, string> = {
    litellm: 'default',
    litellm_deepseek_chat: 'deepseek_chat',
    litellm_deepseek: 'deepseek_chat',
    litellm_deepseek_reasoner: 'deepseek_reasoner',
    litellm_qwen_max: 'qwen_max',
    litellm_qwen_flash: 'qwen_flash',
    oneapi: 'default',
    oneapi_deepseek_chat: 'deepseek_chat',
    oneapi_deepseek: 'deepseek_chat',
    oneapi_deepseek_reasoner: 'deepseek_reasoner',
    oneapi_qwen_max: 'qwen_max',
    oneapi_qwen_flash: 'qwen_flash',
    oneapi_qwen_plus: 'qwen_max',
  }

  for (const [alias, targetKey] of Object.entries(aliases)) {
    const targetConfig = configs[targetKey]
    if (targetConfig) {
      configs[alias] = {
        ...targetConfig,
        name: `${targetConfig.name} (alias)`,
      }
    }
  }

  return configs
}

export const MODEL_CONFIGS = getModelConfigs()

const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'rate_limit',
  'too many requests',
  'quota exceeded',
  '429',
]

function detectRateLimit(content: string): string | null {
  const lower = content.toLowerCase()
  for (const pattern of RATE_LIMIT_PATTERNS) {
    if (lower.includes(pattern)) {
      return `rate limit pattern: "${pattern}"`
    }
  }
  return null
}

export class LLMClient {
  private client: OpenAI
  private config: ModelConfig

  constructor(config: ModelConfig) {
    this.config = config
    this.client = createClient({ timeout: config.timeout || 5 * 60 * 1000, maxRetries: 0, defaultHeaders: { 'User-Agent': 'Context-OS/1.0' } }) as any
  }

  async chat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: {
      temperature?: number
      maxTokens?: number
      responseFormat?: { type: 'json_object' | 'text' }
    }
  ): Promise<{ content: string; duration: number }> {
    const startTime = Date.now()

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens,
        response_format: options?.responseFormat as any,
      })

      const duration = Date.now() - startTime
      const content = response.choices[0]?.message?.content || ''
      recordTiming('llm_chat', duration, { model: this.config.model })

      return { content, duration }
    } catch (error) {
      incrementCounter('llm_error', 1, { model: this.config.model })
      throw error
    }
  }

  async chatStream(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: {
      temperature?: number
      maxTokens?: number
      responseFormat?: { type: 'json_object' | 'text' }
      onEvent?: (event: StreamEvent) => void
    }
  ): Promise<{ content: string; metrics: StreamMetrics }> {
    const startTime = Date.now()
    let fullContent = ''
    let firstTokenTime = 0
    let lastChunkTime = startTime
    const chunkIntervals: number[] = []
    const rateLimitEvents: string[] = []
    let tokenCount = 0

    const emit = (event: StreamEvent) => {
      if (options?.onEvent) {
        options.onEvent(event)
      }
    }

    emit({ type: 'start', timestamp: startTime })

    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens,
        response_format: options?.responseFormat as any,
        stream: true,
      })

      for await (const chunk of stream) {
        const now = Date.now()

        if (firstTokenTime === 0 && chunk.choices[0]?.delta?.content) {
          firstTokenTime = now - startTime
          emit({ type: 'delta', content: '[FIRST_TOKEN]', timestamp: now })
        }

        if (lastChunkTime > 0) {
          chunkIntervals.push(now - lastChunkTime)
        }
        lastChunkTime = now

        const delta = chunk.choices[0]?.delta?.content || ''
        if (delta) {
          fullContent += delta
          tokenCount += 1

          const rateLimitInfo = detectRateLimit(delta)
          if (rateLimitInfo) {
            rateLimitEvents.push(rateLimitInfo)
            emit({ type: 'rate_limit', info: rateLimitInfo, timestamp: now })
          }

          emit({ type: 'delta', content: delta, timestamp: now })
        }
      }

      const endTime = Date.now()
      const totalDuration = endTime - startTime
      const avgChunkInterval = chunkIntervals.length > 0
        ? chunkIntervals.reduce((a, b) => a + b, 0) / chunkIntervals.length
        : 0

      const rateLimitDetected = rateLimitEvents.length > 0 || avgChunkInterval > 5000
      const tokensPerSecond = totalDuration > 0 ? (tokenCount / totalDuration) * 1000 : 0

      const metrics: StreamMetrics = {
        totalDuration,
        firstTokenTime,
        tokenCount,
        tokensPerSecond,
        rateLimitDetected,
        rateLimitEvents,
        avgChunkInterval,
      }

      emit({ type: 'end', timestamp: endTime, fullContent, metrics })
      recordTiming('llm_stream', metrics.totalDuration, { model: this.config.model })

      return { content: fullContent, metrics }
    } catch (error: any) {
      incrementCounter('llm_error', 1, { model: this.config.model })
      emit({ type: 'error', error: error.message, timestamp: Date.now() })
      throw error
    }
  }

  getConfig(): ModelConfig {
    return this.config
  }
}

export function createLLMClient(modelKey: keyof typeof MODEL_CONFIGS | string = 'default'): LLMClient {
  const configs = getModelConfigs()
  const config = configs[modelKey] || configs.default

  if (!config.apiKey) {
    throw new Error('Missing LITELLM_API_KEY or model API key configuration.')
  }

  return new LLMClient(config)
}

export interface ModelComparisonResult {
  model: string
  content: string
  duration: number
  metrics?: StreamMetrics
  error?: string
}

export async function compareModels(
  prompt: string,
  modelKeys: (keyof typeof MODEL_CONFIGS)[],
  options?: {
    useStream?: boolean
    systemPrompt?: string
    temperature?: number
    onProgress?: (model: string, event: StreamEvent) => void
  }
): Promise<ModelComparisonResult[]> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: options?.systemPrompt || 'You are a helpful assistant.' },
    { role: 'user', content: prompt },
  ]

  const results: ModelComparisonResult[] = []

  for (const modelKey of modelKeys) {
    const client = createLLMClient(modelKey)
    const config = client.getConfig()

    try {
      if (options?.useStream) {
        const { content, metrics } = await client.chatStream(messages, {
          temperature: options?.temperature,
          onEvent: (event) => options?.onProgress?.(config.name, event),
        })

        results.push({
          model: config.name,
          content,
          duration: metrics.totalDuration,
          metrics,
        })
      } else {
        const { content, duration } = await client.chat(messages, {
          temperature: options?.temperature,
        })

        results.push({
          model: config.name,
          content,
          duration,
        })
      }
    } catch (error: any) {
      results.push({
        model: config.name,
        content: '',
        duration: 0,
        error: error.message,
      })
    }
  }

  return results
}

const defaultClient = new LLMClient(MODEL_CONFIGS.default)
export default defaultClient
