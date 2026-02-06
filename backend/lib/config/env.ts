type EnvCheck = {
  key: string
  requiredIn: 'all' | 'production'
}

const REQUIRED_ENV: EnvCheck[] = [
  { key: 'DATABASE_URL', requiredIn: 'all' },
  { key: 'JWT_SECRET', requiredIn: 'production' },
  { key: 'QDRANT_URL', requiredIn: 'all' },
  { key: 'LITELLM_BASE_URL', requiredIn: 'all' },
  { key: 'LITELLM_API_KEY', requiredIn: 'all' },
]

let validated = false
let cachedError: Error | null = null

function isRequired(check: EnvCheck, strict: boolean): boolean {
  if (check.requiredIn === 'all') return true
  return strict
}

export function validateEnv(): void {
  if (validated) {
    if (cachedError) throw cachedError
    return
  }

  const strict = process.env.ENV_STRICT === '1' || process.env.NODE_ENV === 'production'
  const missing: string[] = []

  for (const check of REQUIRED_ENV) {
    if (!isRequired(check, strict)) continue
    const value = process.env[check.key]
    if (!value || value.trim().length === 0) {
      missing.push(check.key)
    }
  }

  if (missing.length > 0) {
    const message = `Missing required env: ${missing.join(', ')}`
    const error = new Error(message)
    cachedError = error
    validated = true
    if (strict) {
      throw error
    } else {
      console.warn(`[env] ${message}`)
      cachedError = null
      return
    }
  }

  validated = true
}

export function getEnvDefaults(): Record<string, string> {
  return {
    QDRANT_URL: 'http://127.0.0.1:6333',
    LITELLM_BASE_URL: 'http://localhost:4000',
    EMBEDDING_MODEL: 'qwen3-embedding-4b',
    RERANK_MODEL: 'qwen3-reranker-4b',
    VISION_OCR_MODEL: 'deepseek-ocr',
  }
}
