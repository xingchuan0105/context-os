import { NextRequest } from 'next/server'
import { success, ValidationError, withErrorHandler } from '@/lib/api/errors'
import {
  isLiteLLMEnforcedCapability,
  isModelCapability,
  type ModelCapability,
} from '@/lib/admin/capabilities'
import { requireSuperAdmin } from '@/lib/auth/admin'
import { addModelConfigAuditTestLog } from '@/lib/admin/model-config-store'
import {
  normalizeToOpenAIBaseUrl,
  resolveCapabilityConfig,
  type ResolvedCapabilityConfig,
} from '@/lib/admin/model-config-resolver'
import { migrateLiteLLMSecretsFromEnv } from '@/lib/admin/litellm-models'
import { extractHeadersFromExtra, mergeHeaders } from '@/lib/admin/capability-headers'
import { chat, embed } from '@/lib/llm'
import OpenAI from 'openai'
import axios from 'axios'

export const runtime = 'nodejs'

type Params = { params: Promise<{ capability: string }> }

type TestRequestBody = {
  useSaved?: boolean
  override?: {
    enabled?: boolean
    providerMode?: 'litellm' | 'direct' | 'legacy_oneapi'
    baseUrl?: string | null
    apiKey?: string | null
    model?: string | null
    timeoutMs?: number | null
    extra?: Record<string, unknown> | null
  }
}

function normalizeNullableString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildTestConfig(
  resolved: ResolvedCapabilityConfig,
  override?: TestRequestBody['override'],
): ResolvedCapabilityConfig {
  if (!override) {
    return resolved
  }

  const baseUrl = normalizeNullableString(override.baseUrl)
  const apiKey = normalizeNullableString(override.apiKey)
  const model = normalizeNullableString(override.model)

  return {
    ...resolved,
    enabled: override.enabled ?? resolved.enabled,
    providerMode: override.providerMode ?? resolved.providerMode,
    baseUrl: baseUrl === undefined ? resolved.baseUrl : baseUrl,
    apiKey: apiKey === undefined ? resolved.apiKey : apiKey,
    model: model === undefined ? resolved.model : model,
    timeoutMs: override.timeoutMs === undefined ? resolved.timeoutMs : override.timeoutMs,
    extra: override.extra === undefined ? resolved.extra : (override.extra || {}),
  }
}

function ensureCapability(value: string): ModelCapability {
  if (!isModelCapability(value)) {
    throw new ValidationError('Unsupported capability', { capability: value })
  }
  return value
}

function applyLiteLLMPolicy(
  capability: ModelCapability,
  config: ResolvedCapabilityConfig,
): ResolvedCapabilityConfig {
  if (!isLiteLLMEnforcedCapability(capability)) {
    return config
  }

  return {
    ...config,
    providerMode: 'litellm',
    baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
    apiKey: process.env.LITELLM_API_KEY || process.env.LITELLM_MASTER_KEY || 'local-dev',
  }
}

async function testChatLikeCapability(config: ResolvedCapabilityConfig) {
  if (!config.apiKey) {
    throw new ValidationError('Missing API key for capability test')
  }

  const startedAt = Date.now()
  const result = await chat({
    model: config.model || 'qwen-flash',
    baseURL: normalizeToOpenAIBaseUrl(config.baseUrl) || 'http://localhost:4000/v1',
    apiKey: config.apiKey,
    timeout: config.timeoutMs ?? 20000,
    defaultHeaders: extractHeadersFromExtra(config.extra),
    messages: [{ role: 'user', content: 'ping' }],
    temperature: 0,
    maxTokens: 16,
  })

  return {
    ok: Boolean(result.choices?.[0]?.message?.content),
    latencyMs: Date.now() - startedAt,
    providerMode: config.providerMode,
    model: config.model,
    baseUrl: config.baseUrl,
  }
}

async function testEmbeddingCapability(config: ResolvedCapabilityConfig) {
  if (!config.apiKey) {
    throw new ValidationError('Missing API key for capability test')
  }

  const startedAt = Date.now()
  const result = await embed({
    model: config.model || 'qwen3-embedding-4b',
    baseURL: normalizeToOpenAIBaseUrl(config.baseUrl) || 'http://localhost:4000/v1',
    apiKey: config.apiKey,
    timeout: config.timeoutMs ?? 20000,
    defaultHeaders: extractHeadersFromExtra(config.extra),
    input: 'ping',
  })

  return {
    ok: Array.isArray(result.data) && result.data.length > 0,
    latencyMs: Date.now() - startedAt,
    providerMode: config.providerMode,
    model: config.model,
    baseUrl: config.baseUrl,
  }
}

async function testRerankCapability(config: ResolvedCapabilityConfig) {
  if (!config.apiKey) {
    throw new ValidationError('Missing API key for capability test')
  }

  if (!config.baseUrl) {
    throw new ValidationError('Missing baseUrl for rerank capability test')
  }

  const defaultHeaders = extractHeadersFromExtra(config.extra)
  const hasAuthorizationHeader = Object.keys(defaultHeaders || {}).some(
    (key) => key.toLowerCase() === 'authorization',
  )

  const startedAt = Date.now()
  const response = await axios.post(
    new URL('/rerank', config.baseUrl).toString(),
    {
      model: config.model || 'qwen3-reranker-4b',
      query: 'test query',
      documents: ['alpha', 'beta'],
      top_n: 1,
    },
    {
      headers: mergeHeaders(
        defaultHeaders,
        hasAuthorizationHeader ? undefined : { Authorization: `Bearer ${config.apiKey}` },
        { 'Content-Type': 'application/json' },
      ),
      timeout: config.timeoutMs ?? 30000,
    }
  )

  return {
    ok: Boolean(response?.data),
    latencyMs: Date.now() - startedAt,
    providerMode: config.providerMode,
    model: config.model,
    baseUrl: config.baseUrl,
  }
}

async function testOcrCapability(config: ResolvedCapabilityConfig) {
  if (!config.apiKey) {
    throw new ValidationError('Missing API key for OCR capability test')
  }

  const baseURL = config.baseUrl || 'https://api.siliconflow.cn/v1'
  const startedAt = Date.now()

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL,
    timeout: config.timeoutMs ?? 30000,
    defaultHeaders: extractHeadersFromExtra(config.extra),
  })

  await client.chat.completions.create({
    model: config.model || 'deepseek-ocr',
    messages: [
      { role: 'user', content: 'ping' },
    ],
    max_tokens: 8,
  })

  return {
    ok: true,
    latencyMs: Date.now() - startedAt,
    providerMode: config.providerMode,
    model: config.model,
    baseUrl: config.baseUrl,
  }
}

async function runCapabilityTest(capability: ModelCapability, config: ResolvedCapabilityConfig) {
  switch (capability) {
    case 'embedding':
      return testEmbeddingCapability(config)
    case 'rerank':
      return testRerankCapability(config)
    case 'ocr':
      return testOcrCapability(config)
    case 'chat':
    case 'ktype':
    case 'query_rewrite':
    case 'doc_routing':
    case 'quicknote_summary':
    case 'quicknote_label':
    case 'quicknote_chat':
    case 'legacy_oneapi':
      return testChatLikeCapability(config)
    case 'web_parse_firecrawl':
      return {
        ok: true,
        skipped: true,
        reason: 'Firecrawl test is not implemented in this version',
      }
    default:
      return {
        ok: false,
        skipped: true,
        reason: 'Unsupported test capability',
      }
  }
}

function sanitizeResultPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false }
  }

  const record = value as Record<string, unknown>
  const sanitized: Record<string, unknown> = {
    ...record,
  }

  delete sanitized.apiKey
  delete sanitized.api_key
  delete sanitized.token
  return sanitized
}

export const POST = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const operator = await requireSuperAdmin()

  const { capability: capabilityRaw } = await params
  const capability = ensureCapability(capabilityRaw)

  let body: TestRequestBody = {}
  try {
    body = (await req.json()) as TestRequestBody
  } catch {
    body = {}
  }

  const resolved = resolveCapabilityConfig(capability)
  const testConfig = body.useSaved
    ? resolved
    : buildTestConfig(
        resolved,
        body.override && typeof body.override === 'object' ? body.override : undefined,
      )

  const effectiveConfig = applyLiteLLMPolicy(capability, testConfig)

  if (!effectiveConfig.enabled) {
    throw new ValidationError('Capability is disabled, enable it before testing', { capability })
  }

  const targetModelAlias = effectiveConfig.model?.trim()
  if (effectiveConfig.providerMode === 'litellm' && targetModelAlias) {
    await migrateLiteLLMSecretsFromEnv(targetModelAlias).catch(() => undefined)
  }

  const startedAt = Date.now()
  let result: Record<string, unknown>

  try {
    const rawResult = await runCapabilityTest(capability, effectiveConfig)
    result = sanitizeResultPayload(rawResult)
  } catch (error) {
    const elapsed = Date.now() - startedAt
    const errorMessage = error instanceof Error ? error.message : String(error)

    addModelConfigAuditTestLog(capability, operator.id, {
      ok: false,
      elapsedMs: elapsed,
      error: errorMessage,
      source: effectiveConfig.source,
      useSaved: Boolean(body.useSaved),
      hasOverride: Boolean(body.override),
    })

    throw new ValidationError(`Capability test failed: ${errorMessage}`)
  }

  const elapsed = Date.now() - startedAt
  addModelConfigAuditTestLog(capability, operator.id, {
    ok: true,
    elapsedMs: elapsed,
    source: effectiveConfig.source,
    useSaved: Boolean(body.useSaved),
    hasOverride: Boolean(body.override),
  })

  return success({
    capability,
    elapsedMs: elapsed,
    source: effectiveConfig.source,
    result,
  })
})
