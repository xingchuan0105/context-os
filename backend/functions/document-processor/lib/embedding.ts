import { createClient } from '../../../lib/llm'
import OpenAI from 'openai'

/**
 * Embedding 客户端（使用 LiteLLM 统一调用）
 */
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

// 默认导出：单例客户端
const embeddingClient = getEmbeddingClient()
export default embeddingClient
export { getEmbeddingClient }
