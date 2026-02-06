// OneAPI 客户端配置
// 所有 LLM 调用必须经过 OneAPI 网关

import OpenAI from 'openai'

// 从环境变量读取超时配置（毫秒），默认 5 分钟
const DEFAULT_TIMEOUT = 5 * 60 * 1000  // 5 分钟
const LLM_TIMEOUT = parseInt(process.env.LLM_TIMEOUT_MS || String(DEFAULT_TIMEOUT))

const oneapi = new OpenAI({
  apiKey: process.env.ONEAPI_API_KEY || '',
  baseURL: process.env.ONEAPI_BASE_URL || 'http://localhost:3000/v1',
  timeout: LLM_TIMEOUT,
  // 增加重试配置
  maxRetries: 2,
  // 默认请求配置
  defaultQuery: {},
  defaultHeaders: {
    'User-Agent': 'Context-OS/1.0',
  },
})

export default oneapi
export { LLM_TIMEOUT }
