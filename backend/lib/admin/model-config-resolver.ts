import {
  type ModelCapability,
  type ProviderMode,
  isLiteLLMEnforcedCapability,
} from './capabilities'
import { getModelCapabilityConfigInternal } from './model-config-store'
import { maskApiKey } from './model-config-security'
import { extractHeadersFromExtra } from './capability-headers'

export type ResolvedCapabilityConfig = {
  capability: ModelCapability
  enabled: boolean
  providerMode: ProviderMode
  baseUrl: string | null
  apiKey: string | null
  apiKeyMasked: string | null
  model: string | null
  timeoutMs: number | null
  extra: Record<string, unknown>
  source: 'db' | 'env' | 'default'
}

export type CapabilityClientOverrides = {
  baseURL?: string
  apiKey?: string
  model?: string
  timeout?: number
  defaultHeaders?: Record<string, string>
}

type EnvDefaults = {
  enabled?: boolean
  providerMode?: ProviderMode
  baseUrl?: string | null
  apiKey?: string | null
  model?: string | null
  timeoutMs?: number | null
  extra?: Record<string, unknown>
}

function parseIntEnv(key: string, fallback: number | null = null): number | null {
  const value = process.env[key]
  if (!value) return fallback
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function fallbackUrl(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim()
  }
  return null
}

function fallbackKey(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim()
  }
  return null
}

function envDefaults(capability: ModelCapability): EnvDefaults {
  switch (capability) {
    case 'chat':
      return {
        enabled: true,
        providerMode: 'litellm',
        baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
        apiKey: process.env.LITELLM_API_KEY || null,
        model: process.env.DEFAULT_MODEL || process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat',
        timeoutMs: parseIntEnv('LLM_TIMEOUT_MS', 5 * 60 * 1000),
      }
    case 'ktype':
      return {
        enabled: true,
        providerMode: 'litellm',
        baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
        apiKey: process.env.LITELLM_API_KEY || null,
        model: process.env.KTYPE_MODEL || process.env.QWEN_FLASH_MODEL || 'qwen-flash',
        timeoutMs: parseIntEnv('LLM_TIMEOUT_MS', 5 * 60 * 1000),
      }
    case 'embedding':
      return {
        enabled: true,
        providerMode: 'litellm',
        baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
        apiKey: process.env.LITELLM_API_KEY || null,
        model: process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b',
        timeoutMs: parseIntEnv('EMBEDDING_TIMEOUT_MS', 2 * 60 * 1000),
      }
    case 'rerank':
      return {
        enabled: process.env.USE_RERANK !== '0',
        providerMode: 'litellm',
        baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
        apiKey: process.env.LITELLM_API_KEY || null,
        model: process.env.RERANK_MODEL || 'qwen3-reranker-4b',
        timeoutMs: parseIntEnv('RERANK_TIMEOUT_MS', 30_000),
      }
    case 'ocr':
      return {
        enabled: true,
        providerMode: 'litellm',
        baseUrl: fallbackUrl(
          process.env.VISION_OCR_BASE_URL,
          process.env.LITELLM_BASE_URL,
          process.env.SILICONFLOW_BASE_URL,
          'https://api.siliconflow.cn/v1'
        ),
        apiKey: fallbackKey(
          process.env.VISION_OCR_API_KEY,
          process.env.LITELLM_API_KEY,
          process.env.SILICONFLOW_API_KEY
        ),
        model: process.env.VISION_OCR_MODEL || 'deepseek-ocr',
        timeoutMs: parseIntEnv('VISION_OCR_TIMEOUT_MS', 180_000),
        extra: {
          prompt: process.env.VISION_OCR_PROMPT || '',
          systemPrompt: process.env.VISION_OCR_SYSTEM_PROMPT || '',
          useRawBaseUrl: process.env.VISION_OCR_BASE_URL_RAW === 'true',
        },
      }
    case 'query_rewrite':
    case 'doc_routing':
    case 'quicknote_summary':
    case 'quicknote_label':
    case 'quicknote_chat':
      return {
        enabled: true,
        providerMode: 'litellm',
        baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
        apiKey: process.env.LITELLM_API_KEY || null,
        model: process.env.QWEN_FLASH_MODEL || 'qwen-flash',
        timeoutMs: parseIntEnv('LLM_TIMEOUT_MS', 5 * 60 * 1000),
      }
    case 'web_parse_firecrawl':
      return {
        enabled: false,
        providerMode: 'direct',
        baseUrl: process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1',
        apiKey: process.env.FIRECRAWL_API_KEY || null,
        timeoutMs: parseIntEnv('FIRECRAWL_TIMEOUT_MS', 60_000),
      }
    case 'legacy_oneapi':
      return {
        enabled: false,
        providerMode: 'litellm',
        baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
        apiKey: process.env.LITELLM_API_KEY || process.env.LITELLM_MASTER_KEY || null,
        model: process.env.DEFAULT_MODEL || null,
        timeoutMs: parseIntEnv('LLM_TIMEOUT_MS', 5 * 60 * 1000),
      }
    default:
      return {
        enabled: true,
        providerMode: 'litellm',
        baseUrl: process.env.LITELLM_BASE_URL || null,
        apiKey: process.env.LITELLM_API_KEY || null,
        model: null,
        timeoutMs: null,
      }
  }
}

export function resolveCapabilityConfig(capability: ModelCapability): ResolvedCapabilityConfig {
  const stored = getModelCapabilityConfigInternal(capability)
  const defaults = envDefaults(capability)

  const source: 'db' | 'env' | 'default' = stored
    ? 'db'
    : defaults.baseUrl || defaults.apiKey || defaults.model
      ? 'env'
      : 'default'

  const enabled = stored?.enabled ?? defaults.enabled ?? true
  const litellmEnforced = isLiteLLMEnforcedCapability(capability)
  const providerModeRaw = stored?.providerMode ?? defaults.providerMode ?? 'litellm'
  const providerMode = litellmEnforced ? 'litellm' : providerModeRaw

  const baseUrlFallback = stored?.baseUrl ?? defaults.baseUrl ?? null
  const apiKeyFallback = stored?.apiKey ?? defaults.apiKey ?? null
  const baseUrl = litellmEnforced
    ? fallbackUrl(process.env.LITELLM_BASE_URL, 'http://localhost:4000')
    : baseUrlFallback
  const apiKey = litellmEnforced
    ? fallbackKey(process.env.LITELLM_API_KEY, process.env.LITELLM_MASTER_KEY, 'local-dev')
    : apiKeyFallback
  const apiKeyMasked = litellmEnforced ? maskApiKey(apiKey) : (stored?.apiKeyMasked ?? null)
  const model = stored?.model ?? defaults.model ?? null
  const timeoutMs = stored?.timeoutMs ?? defaults.timeoutMs ?? null
  const extra = {
    ...(defaults.extra || {}),
    ...(stored?.extra || {}),
  }

  return {
    capability,
    enabled,
    providerMode,
    baseUrl,
    apiKey,
    apiKeyMasked,
    model,
    timeoutMs,
    extra,
    source,
  }
}

export function normalizeToOpenAIBaseUrl(baseUrl?: string | null): string | undefined {
  if (!baseUrl) return undefined
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

export function resolveCapabilityClientOverrides(capability: ModelCapability): CapabilityClientOverrides {
  const resolved = resolveCapabilityConfig(capability)
  const defaultHeaders = extractHeadersFromExtra(resolved.extra)

  const litellmEnforced = isLiteLLMEnforcedCapability(capability)

  const enforcedBaseUrl = litellmEnforced
    ? normalizeToOpenAIBaseUrl(fallbackUrl(process.env.LITELLM_BASE_URL, 'http://localhost:4000'))
    : normalizeToOpenAIBaseUrl(resolved.baseUrl)

  const enforcedApiKey = litellmEnforced
    ? fallbackKey(process.env.LITELLM_API_KEY, process.env.LITELLM_MASTER_KEY, 'local-dev') || undefined
    : resolved.apiKey || undefined

  return {
    baseURL: enforcedBaseUrl,
    apiKey: enforcedApiKey,
    model: resolved.model || undefined,
    timeout: resolved.timeoutMs ?? undefined,
    defaultHeaders,
  }
}
