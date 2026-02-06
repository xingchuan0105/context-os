// Embedding client - unified via LiteLLM
import { createClient } from './llm'
import type OpenAI from 'openai'

function getEmbeddingClient() {
  const DEFAULT_EMBEDDING_TIMEOUT = 2 * 60 * 1000 // 2 分钟
  const EMBEDDING_TIMEOUT = parseInt(process.env.EMBEDDING_TIMEOUT_MS || String(DEFAULT_EMBEDDING_TIMEOUT))

  return createClient({
    timeout: EMBEDDING_TIMEOUT,
    maxRetries: 2,
    defaultHeaders: {
      'User-Agent': 'Context-OS/1.0',
    },
  }) as any
}

let embeddingClient: OpenAI | null = null

function getOrCreateClient(): OpenAI {
  if (!embeddingClient) {
    embeddingClient = getEmbeddingClient()
  }
  return embeddingClient as OpenAI
}

// 默认导出代理，保持与原 API 兼容
export default new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getOrCreateClient()
      return client[prop as keyof OpenAI]
    },
  }
)

export { getEmbeddingClient }
