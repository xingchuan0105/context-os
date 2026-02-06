import 'dotenv/config'

import { validateEnv } from '../lib/config/env'
import { healthCheck } from '../lib/qdrant'

const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || ''

const SKIP_EXTERNAL = process.env.SELF_CHECK_SKIP_EXTERNAL === '1'
const REQUIRE_EXTERNAL = process.env.SELF_CHECK_REQUIRE_EXTERNAL !== '0'
const REQUEST_TIMEOUT_MS = parseInt(process.env.SELF_CHECK_TIMEOUT_MS || '8000', 10)

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function checkLiteLLM(): Promise<void> {
  const res = await fetchWithTimeout(
    new URL('/v1/models', LITELLM_BASE_URL).toString(),
    {
      headers: LITELLM_API_KEY ? { Authorization: `Bearer ${LITELLM_API_KEY}` } : undefined,
    },
    REQUEST_TIMEOUT_MS
  )

  if (!res.ok) {
    throw new Error(`LiteLLM /v1/models failed: ${res.status}`)
  }
}

async function main() {
  validateEnv()

  if (SKIP_EXTERNAL) {
    console.log('[selfcheck] external checks skipped')
    return
  }

  const qdrantOk = await healthCheck()
  if (!qdrantOk) {
    const msg = 'Qdrant health check failed'
    if (REQUIRE_EXTERNAL) {
      throw new Error(msg)
    }
    console.warn(`[selfcheck] ${msg}`)
  }

  try {
    await checkLiteLLM()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (REQUIRE_EXTERNAL) {
      throw new Error(msg)
    }
    console.warn(`[selfcheck] ${msg}`)
  }

  console.log('[selfcheck] ok')
}

main().catch((err) => {
  console.error('[selfcheck] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
