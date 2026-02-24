import axios from 'axios'
import { ValidationError } from '@/lib/api/errors'
import { db } from '@/lib/db/schema'
import { decryptSecret, encryptSecret, maskApiKey } from './model-config-security'

type LiteLLMModelInfoRaw = Record<string, unknown>

export type LiteLLMModelCategory = "llm" | "ocr_vl" | "embedding" | "rerank" | "other"

export type LiteLLMModelRecord = {
  modelName: string
  litellmModel: string
  apiBase: string | null
  apiKeyMasked: string | null
  mode: string | null
  category: LiteLLMModelCategory
  raw: LiteLLMModelInfoRaw
}

export type UpsertLiteLLMModelInput = {
  modelName: string
  litellmModel: string
  apiBase?: string | null
  apiKey?: string | null
  clearApiKey?: boolean
  mode?: string | null
  extraParams?: Record<string, unknown>
}

type NormalizedUpsertLiteLLMModelInput = {
  modelName: string
  litellmModel: string
  apiBase: string | null
  apiKey?: string | null
  clearApiKey: boolean
  mode: string | null
  extraParams: Record<string, unknown>
}

type LiteLLMModelSecretRow = {
  id: string
  model_name: string
  api_key_ciphertext: string
  api_key_masked: string | null
  created_at: string
  updated_at: string
}

export type LiteLLMModelSecretSource = 'table' | 'env'

export type LiteLLMModelSecret = {
  modelName: string
  apiKey: string
  apiKeyMasked: string | null
  source: LiteLLMModelSecretSource
  envVar: string | null
}

export type LiteLLMSecretMigrationResult = {
  modelName: string | null
  scanned: number
  migrated: number
  skipped: number
  details: Array<{
    modelName: string
    status: 'migrated' | 'skipped'
    reason: string
    envVar: string | null
  }>
}

type EnvKeyResolution = {
  apiKey: string
  envVar: string
}

const KNOWN_LITELLM_PROVIDER_PREFIXES = new Set([
  'openai',
  'azure',
  'anthropic',
  'vertex_ai',
  'bedrock',
  'cohere',
  'mistral',
  'huggingface',
  'ollama',
  'jina_ai',
  'replicate',
  'together_ai',
  'groq',
  'fireworks_ai',
  'openrouter',
  'perplexity',
  'deepseek',
  'xai',
  'sambanova',
  'watsonx',
  'voyage',
  'dashscope',
  'zhipu',
])

const BASE_HOST_ENV_MAPPING: Array<{ needle: string; envVar: string }> = [
  { needle: 'siliconflow', envVar: 'SILICONFLOW_API_KEY' },
  { needle: 'deepseek', envVar: 'DEEPSEEK_API_KEY' },
  { needle: 'dashscope', envVar: 'DASHSCOPE_API_KEY' },
  { needle: 'aliyuncs', envVar: 'DASHSCOPE_API_KEY' },
  { needle: 'openai.com', envVar: 'OPENAI_API_KEY' },
  { needle: 'anthropic.com', envVar: 'ANTHROPIC_API_KEY' },
  { needle: 'openrouter.ai', envVar: 'OPENROUTER_API_KEY' },
  { needle: 'groq.com', envVar: 'GROQ_API_KEY' },
  { needle: 'together.xyz', envVar: 'TOGETHER_API_KEY' },
  { needle: 'fireworks.ai', envVar: 'FIREWORKS_API_KEY' },
  { needle: 'x.ai', envVar: 'XAI_API_KEY' },
  { needle: 'mistral.ai', envVar: 'MISTRAL_API_KEY' },
  { needle: 'cohere.ai', envVar: 'COHERE_API_KEY' },
  { needle: 'bigmodel.cn', envVar: 'ZHIPU_API_KEY' },
]

const PROVIDER_ENV_MAPPING: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  dashscope: 'DASHSCOPE_API_KEY',
  zhipu: 'ZHIPU_API_KEY',
  cohere: 'COHERE_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  xai: 'XAI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeOptionalApiKey(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function resolveEnvApiKeyFromRow(row: LiteLLMModelInfoRaw): EnvKeyResolution | null {
  const litellmParams = normalizeObject(row.litellm_params || row.litellmParams)
  const apiBase = normalizeString(litellmParams.api_base || litellmParams.apiBase || row.api_base)
  const litellmModel = normalizeString(litellmParams.model || row.model || row.litellm_model)

  if (apiBase) {
    const baseLower = apiBase.toLowerCase()
    for (const item of BASE_HOST_ENV_MAPPING) {
      if (!baseLower.includes(item.needle)) {
        continue
      }

      const value = normalizeString(process.env[item.envVar])
      if (value) {
        return {
          apiKey: value,
          envVar: item.envVar,
        }
      }
    }
  }

  if (litellmModel) {
    const provider = (litellmModel.split('/')[0] || '').trim().toLowerCase()
    const envVar = PROVIDER_ENV_MAPPING[provider]
    if (envVar) {
      const value = normalizeString(process.env[envVar])
      if (value) {
        return {
          apiKey: value,
          envVar,
        }
      }
    }
  }

  return null
}

function findLiteLLMModelRowByName(payload: unknown, modelName: string): LiteLLMModelInfoRaw | null {
  const normalized = normalizeString(modelName)
  if (!normalized) {
    return null
  }

  const target = normalized.toLowerCase()
  for (const row of parseModelRows(payload)) {
    const rowModelName = normalizeString(row.model_name || row.modelName || row.id)
    if (!rowModelName || rowModelName.toLowerCase() !== target) {
      continue
    }

    return row
  }

  return null
}

async function syncLiteLLMProxyModelApiKey(row: LiteLLMModelInfoRaw, apiKey: string): Promise<boolean> {
  const normalizedApiKey = normalizeString(apiKey)
  if (!normalizedApiKey) {
    return false
  }

  const modelName = normalizeString(row.model_name || row.modelName || row.id)
  const rawParams = normalizeObject(row.litellm_params || row.litellmParams)
  const litellmModel = normalizeString(rawParams.model || row.model || row.litellm_model)

  if (!modelName || !litellmModel) {
    return false
  }

  const litellmParams: Record<string, unknown> = {
    ...rawParams,
    model: litellmModel,
    api_key: normalizedApiKey,
  }

  const apiBase = normalizeString(rawParams.api_base || rawParams.apiBase || row.api_base)
  if (apiBase) {
    litellmParams.api_base = apiBase
  }

  const payload: Record<string, unknown> = {
    model_name: modelName,
    litellm_params: litellmParams,
  }

  const rowModelInfo = normalizeObject(row.model_info || row.modelInfo)
  const mode = normalizeString(rowModelInfo.mode || row.mode)
  const modelId = getModelIdFromRow(row)
  if (mode || modelId) {
    payload.model_info = {
      ...(mode ? { mode } : {}),
      ...(modelId ? { id: modelId } : {}),
    }
  }

  if (modelId) {
    const encodedModelId = encodeURIComponent(modelId)
    try {
      await callLiteLLMPatchWithFallback(
        [
          `/model/${encodedModelId}/update`,
          `/v1/model/${encodedModelId}/update`,
        ],
        payload,
      )
      return true
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error
      }
    }
  }

  try {
    await callLiteLLMPostWithFallback(['/model/update', '/v1/model/update'], payload)
    return true
  } catch (error) {
    if (error instanceof ValidationError) {
      return false
    }
    throw error
  }
}

function nowISO(): string {
  return new Date().toISOString()
}

function createSecretId(): string {
  return `litellm_secret_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`
}

function listLiteLLMModelSecretRows(): LiteLLMModelSecretRow[] {
  try {
    return db
      .prepare(
        `SELECT id, model_name, api_key_ciphertext, api_key_masked, created_at, updated_at
           FROM admin_litellm_model_secrets`,
      )
      .all() as LiteLLMModelSecretRow[]
  } catch {
    return []
  }
}

function getLiteLLMModelSecretRow(modelName: string): LiteLLMModelSecretRow | null {
  try {
    const row = db
      .prepare(
        `SELECT id, model_name, api_key_ciphertext, api_key_masked, created_at, updated_at
           FROM admin_litellm_model_secrets
          WHERE model_name = ?`,
      )
      .get(modelName) as LiteLLMModelSecretRow | undefined

    return row || null
  } catch {
    return null
  }
}

function listLiteLLMModelSecretMaskMap(): Map<string, string | null> {
  const map = new Map<string, string | null>()

  for (const row of listLiteLLMModelSecretRows()) {
    const modelName = normalizeString(row.model_name)
    if (!modelName) {
      continue
    }

    map.set(modelName, row.api_key_masked || null)
  }

  return map
}

function upsertLiteLLMModelSecret(modelName: string, apiKey: string): void {
  const normalizedModelName = normalizeString(modelName)
  const normalizedApiKey = normalizeString(apiKey)

  if (!normalizedModelName || !normalizedApiKey) {
    return
  }

  const now = nowISO()
  const ciphertext = encryptSecret(normalizedApiKey)
  const masked = maskApiKey(normalizedApiKey)
  const existing = getLiteLLMModelSecretRow(normalizedModelName)

  if (existing) {
    db.prepare(
      `UPDATE admin_litellm_model_secrets
          SET api_key_ciphertext = ?, api_key_masked = ?, updated_at = ?
        WHERE model_name = ?`,
    ).run(ciphertext, masked, now, normalizedModelName)
    return
  }

  db.prepare(
    `INSERT INTO admin_litellm_model_secrets
      (id, model_name, api_key_ciphertext, api_key_masked, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(createSecretId(), normalizedModelName, ciphertext, masked, now, now)
}

function deleteLiteLLMModelSecret(modelName: string): void {
  const normalized = normalizeString(modelName)
  if (!normalized) {
    return
  }

  db.prepare('DELETE FROM admin_litellm_model_secrets WHERE model_name = ?').run(normalized)
}

function syncLiteLLMModelSecret(normalized: NormalizedUpsertLiteLLMModelInput): void {
  if (normalized.clearApiKey) {
    deleteLiteLLMModelSecret(normalized.modelName)
    return
  }

  if (typeof normalized.apiKey === 'string' && normalized.apiKey.trim()) {
    upsertLiteLLMModelSecret(normalized.modelName, normalized.apiKey)
  }
}

export function getLiteLLMModelSecret(modelName: string): LiteLLMModelSecret | null {
  const normalized = normalizeString(modelName)
  if (!normalized) {
    return null
  }

  const row = getLiteLLMModelSecretRow(normalized)
  if (row) {
    const decrypted = decryptSecret(row.api_key_ciphertext)
    const apiKey = normalizeString(decrypted)
    if (apiKey) {
      return {
        modelName: normalized,
        apiKey,
        apiKeyMasked: row.api_key_masked || maskApiKey(apiKey),
        source: 'table',
        envVar: null,
      }
    }
  }
  return null
}

export async function resolveLiteLLMModelSecret(modelName: string): Promise<LiteLLMModelSecret | null> {
  const normalized = normalizeString(modelName)
  if (!normalized) {
    return null
  }

  const fromTable = getLiteLLMModelSecret(normalized)
  if (fromTable) {
    return fromTable
  }

  try {
    const { data } = await callLiteLLMGetWithFallback<unknown>(['/model/info', '/v1/model/info'])
    const row = findLiteLLMModelRowByName(data, normalized)
    if (!row) {
      return null
    }

    const envResolved = resolveEnvApiKeyFromRow(row)
    if (!envResolved) {
      return null
    }

    return {
      modelName: normalized,
      apiKey: envResolved.apiKey,
      apiKeyMasked: maskApiKey(envResolved.apiKey),
      source: 'env',
      envVar: envResolved.envVar,
    }
  } catch {
    return null
  }
}

export async function migrateLiteLLMSecretsFromEnv(modelName?: string): Promise<LiteLLMSecretMigrationResult> {
  const normalizedTarget = normalizeString(modelName)
  const { data } = await callLiteLLMGetWithFallback<unknown>(['/model/info', '/v1/model/info'])
  const allRows = parseModelRows(data)

  const scopedRows = normalizedTarget
    ? allRows.filter((row) => {
        const rowModelName = normalizeString(row.model_name || row.modelName || row.id)
        return Boolean(rowModelName && rowModelName.toLowerCase() === normalizedTarget.toLowerCase())
      })
    : allRows

  const details: LiteLLMSecretMigrationResult['details'] = []
  const forceProxySync = Boolean(normalizedTarget)
  let migrated = 0
  let skipped = 0

  for (const row of scopedRows) {
    const rowModelName = normalizeString(row.model_name || row.modelName || row.id)
    if (!rowModelName) {
      continue
    }

    const existing = getLiteLLMModelSecretRow(rowModelName)

    let apiKey: string | null = null
    let envVar: string | null = null

    if (existing) {
      apiKey = normalizeString(decryptSecret(existing.api_key_ciphertext))
    }

    if (!apiKey) {
      const resolved = resolveEnvApiKeyFromRow(row)
      if (resolved) {
        apiKey = resolved.apiKey
        envVar = resolved.envVar
      }
    }

    if (!apiKey) {
      skipped += 1
      details.push({
        modelName: rowModelName,
        status: 'skipped',
        reason: 'no matching env key found',
        envVar: null,
      })
      continue
    }

    let inserted = false
    if (!existing) {
      upsertLiteLLMModelSecret(rowModelName, apiKey)
      inserted = true
      migrated += 1
    }

    let proxySynced = false
    if (inserted || forceProxySync) {
      proxySynced = await syncLiteLLMProxyModelApiKey(row, apiKey)
    }

    if (inserted) {
      details.push({
        modelName: rowModelName,
        status: 'migrated',
        reason: proxySynced ? 'migrated from env and synced proxy key' : 'migrated from env',
        envVar,
      })
      continue
    }

    skipped += 1
    details.push({
      modelName: rowModelName,
      status: 'skipped',
      reason: proxySynced ? 'secret already exists in table; proxy key synced' : 'secret already exists in table',
      envVar,
    })
  }

  return {
    modelName: normalizedTarget,
    scanned: scopedRows.length,
    migrated,
    skipped,
    details,
  }
}

function normalizeLiteLLMProviderModel(input: {
  litellmModel: string
  apiBase: string | null
}): string {
  const normalizedModel = normalizeString(input.litellmModel)
  if (!normalizedModel) {
    throw new ValidationError('litellmModel is required')
  }

  const [firstSegment] = normalizedModel.split('/')
  const first = (firstSegment || '').trim()
  const firstLower = first.toLowerCase()

  if (KNOWN_LITELLM_PROVIDER_PREFIXES.has(firstLower)) {
    return normalizedModel
  }

  const hasApiBase = Boolean(normalizeString(input.apiBase))
  const shouldAutoPrefixOpenAI =
    hasApiBase ||
    !normalizedModel.includes('/') ||
    /[A-Z]/.test(first)

  if (!shouldAutoPrefixOpenAI) {
    return normalizedModel
  }

  return `openai/${normalizedModel.replace(/^openai\//i, '')}`
}

function getAdminBaseUrl(): string {
  const value =
    process.env.LITELLM_ADMIN_BASE_URL ||
    process.env.LITELLM_USAGE_BASE_URL ||
    process.env.LITELLM_BASE_URL ||
    ''

  const normalized = normalizeString(value)
  if (!normalized) {
    throw new ValidationError(
      'Missing LiteLLM admin base URL. Set LITELLM_ADMIN_BASE_URL or LITELLM_BASE_URL.',
    )
  }

  return normalized.replace(/\/+$/, '')
}

function getAdminApiKey(): string {
  const value =
    process.env.LITELLM_ADMIN_API_KEY ||
    process.env.LITELLM_USAGE_API_KEY ||
    process.env.LITELLM_MASTER_KEY ||
    process.env.LITELLM_API_KEY ||
    ''

  const normalized = normalizeString(value)
  if (!normalized) {
    throw new ValidationError(
      'Missing LiteLLM admin API key. Set LITELLM_ADMIN_API_KEY or LITELLM_MASTER_KEY.',
    )
  }

  return normalized
}

function getTimeoutMs(): number {
  const raw = Number.parseInt(process.env.LITELLM_ADMIN_TIMEOUT_MS || '', 10)
  if (!Number.isFinite(raw) || raw <= 0) return 15000
  return Math.min(raw, 60000)
}

function buildHeaders() {
  return {
    Authorization: `Bearer ${getAdminApiKey()}`,
    'Content-Type': 'application/json',
  }
}

function formatAxiosError(endpoint: string, error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return `${endpoint}: ${error instanceof Error ? error.message : String(error)}`
  }

  const status = error.response?.status
  const detail = error.response?.data
    ? typeof error.response.data === 'string'
      ? error.response.data
      : JSON.stringify(error.response.data)
    : error.message

  return `${endpoint}: ${status || 'ERR'} ${detail}`
}

function withLiteLLMAdminHint(message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('db not connected') ||
    normalized.includes('database not connected') ||
    normalized.includes('connect a database')
  ) {
    return `${message} | LiteLLM 数据库未连接：请为 litellm 容器配置 DATABASE_URL、LITELLM_MASTER_KEY，并启用 STORE_MODEL_IN_DB=true。`
  }

  if (
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('master key') ||
    normalized.includes('invalid user key')
  ) {
    return `${message} | LiteLLM 管理接口鉴权失败：请确认 LITELLM_ADMIN_API_KEY 使用了 master key。`
  }

  return message
}

async function callLiteLLMGetWithFallback<T>(paths: string[]): Promise<{ path: string; data: T }> {
  const baseUrl = getAdminBaseUrl()
  const timeout = getTimeoutMs()
  const headers = buildHeaders()
  const errors: string[] = []

  for (const path of paths) {
    const endpoint = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    try {
      const response = await axios.get<T>(endpoint, { headers, timeout })
      return { path, data: response.data }
    } catch (error) {
      errors.push(formatAxiosError(endpoint, error))
    }
  }

  throw new ValidationError(
    withLiteLLMAdminHint(`LiteLLM admin GET failed: ${errors.slice(0, 2).join(' | ')}`),
  )
}

async function callLiteLLMPostWithFallback<T>(
  paths: string[],
  payload: Record<string, unknown>,
): Promise<{ path: string; data: T }> {
  const baseUrl = getAdminBaseUrl()
  const timeout = getTimeoutMs()
  const headers = buildHeaders()
  const errors: string[] = []

  for (const path of paths) {
    const endpoint = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    try {
      const response = await axios.post<T>(endpoint, payload, { headers, timeout })
      return { path, data: response.data }
    } catch (error) {
      errors.push(formatAxiosError(endpoint, error))
    }
  }

  throw new ValidationError(
    withLiteLLMAdminHint(`LiteLLM admin POST failed: ${errors.slice(0, 2).join(' | ')}`),
  )
}

async function callLiteLLMPatchWithFallback<T>(
  paths: string[],
  payload: Record<string, unknown>,
): Promise<{ path: string; data: T }> {
  const baseUrl = getAdminBaseUrl()
  const timeout = getTimeoutMs()
  const headers = buildHeaders()
  const errors: string[] = []

  for (const path of paths) {
    const endpoint = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    try {
      const response = await axios.patch<T>(endpoint, payload, { headers, timeout })
      return { path, data: response.data }
    } catch (error) {
      errors.push(formatAxiosError(endpoint, error))
    }
  }

  throw new ValidationError(
    withLiteLLMAdminHint(`LiteLLM admin PATCH failed: ${errors.slice(0, 2).join(' | ')}`),
  )
}

function parseModelRows(payload: unknown): LiteLLMModelInfoRaw[] {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object') as LiteLLMModelInfoRaw[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>

  const candidates: unknown[] = [record.data, record.models, record.model_info, record.results]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => item && typeof item === 'object') as LiteLLMModelInfoRaw[]
    }
  }

  return []
}

function inferLiteLLMModelCategory(params: {
  modelName: string
  litellmModel: string
  mode: string | null
}): LiteLLMModelCategory {
  const mode = (params.mode || "").toLowerCase()
  const combined = (params.modelName + ' ' + params.litellmModel).toLowerCase()

  if (mode.includes("embedding") || combined.includes("embedding")) {
    return "embedding"
  }

  if (mode.includes("rerank") || combined.includes("rerank")) {
    return "rerank"
  }

  if (
    mode.includes("image") ||
    mode.includes("vision") ||
    combined.includes("ocr") ||
    combined.includes("-vl") ||
    combined.includes("vision") ||
    combined.includes("multimodal")
  ) {
    return "ocr_vl"
  }

  if (mode.includes("chat") || mode.includes("completion")) {
    return "llm"
  }

  if (
    combined.includes("gpt") ||
    combined.includes("qwen") ||
    combined.includes("deepseek") ||
    combined.includes("glm")
  ) {
    return "llm"
  }

  return "other"
}

function normalizeModelRecord(
  row: LiteLLMModelInfoRaw,
  secretMaskMap: Map<string, string | null>,
): LiteLLMModelRecord | null {
  const modelName = normalizeString(row.model_name || row.modelName || row.id)
  const litellmParams = normalizeObject(row.litellm_params || row.litellmParams)
  const litellmModel = normalizeString(litellmParams.model || row.model || row.litellm_model)

  if (!modelName || !litellmModel) {
    return null
  }

  const apiBase = normalizeString(litellmParams.api_base || litellmParams.apiBase || row.api_base)
  const apiKeyRaw = normalizeString(litellmParams.api_key || litellmParams.apiKey || row.api_key)
  const modelInfo = normalizeObject(row.model_info || row.modelInfo)
  const mode = normalizeString(modelInfo.mode || row.mode)
  const localMasked = secretMaskMap.get(modelName) || null

  return {
    modelName,
    litellmModel,
    apiBase,
    apiKeyMasked: maskApiKey(apiKeyRaw) || localMasked,
    mode,
    category: inferLiteLLMModelCategory({ modelName, litellmModel, mode }),
    raw: row,
  }
}

function getModelIdFromRow(row: LiteLLMModelInfoRaw): string | null {
  const modelInfo = normalizeObject(row.model_info || row.modelInfo)
  return normalizeString(modelInfo.id || row.model_id || row.modelId || row.id)
}

async function findLiteLLMModelIdsByName(modelName: string): Promise<string[]> {
  const normalizedTarget = normalizeString(modelName)
  if (!normalizedTarget) {
    return []
  }

  const { data } = await callLiteLLMGetWithFallback<unknown>([
    '/model/info',
    '/v1/model/info',
  ])

  const target = normalizedTarget.toLowerCase()
  const modelIds: string[] = []
  const seen = new Set<string>()

  for (const row of parseModelRows(data)) {
    const rowModelName = normalizeString(row.model_name || row.modelName || row.id)
    if (!rowModelName || rowModelName.toLowerCase() !== target) {
      continue
    }

    const modelId = getModelIdFromRow(row)
    if (!modelId || seen.has(modelId)) {
      continue
    }

    seen.add(modelId)
    modelIds.push(modelId)
  }

  return modelIds
}

export async function listLiteLLMModels(): Promise<LiteLLMModelRecord[]> {
  const { data } = await callLiteLLMGetWithFallback<unknown>([
    '/model/info',
    '/v1/model/info',
  ])
  const secretMaskMap = listLiteLLMModelSecretMaskMap()

  return parseModelRows(data)
    .map((row) => normalizeModelRecord(row, secretMaskMap))
    .filter((row): row is LiteLLMModelRecord => Boolean(row))
    .sort((a, b) => a.modelName.localeCompare(b.modelName))
}

function normalizeUpsertInput(input: UpsertLiteLLMModelInput): NormalizedUpsertLiteLLMModelInput {
  const modelName = normalizeString(input.modelName)
  const apiBase = normalizeString(input.apiBase)
  const litellmModel = normalizeLiteLLMProviderModel({
    litellmModel: input.litellmModel,
    apiBase,
  })
  const clearApiKey = input.clearApiKey === true || input.apiKey === null
  const normalizedApiKey = normalizeOptionalApiKey(input.apiKey)

  if (!modelName) {
    throw new ValidationError('modelName is required')
  }

  let apiKey: string | null | undefined = normalizedApiKey
  if (clearApiKey) {
    apiKey = null
  }

  return {
    modelName,
    litellmModel,
    apiBase,
    apiKey,
    clearApiKey,
    mode: normalizeString(input.mode),
    extraParams: normalizeObject(input.extraParams),
  }
}

function buildUpsertPayload(input: UpsertLiteLLMModelInput): {
  payload: Record<string, unknown>
  normalized: NormalizedUpsertLiteLLMModelInput
} {
  const normalized = normalizeUpsertInput(input)

  const litellmParams: Record<string, unknown> = {
    model: normalized.litellmModel,
    ...(normalized.extraParams || {}),
  }

  if (normalized.apiBase) {
    litellmParams.api_base = normalized.apiBase
  }

  if (normalized.clearApiKey) {
    litellmParams.api_key = ''
  } else if (typeof normalized.apiKey === 'string' && normalized.apiKey) {
    litellmParams.api_key = normalized.apiKey
  }

  const payload: Record<string, unknown> = {
    model_name: normalized.modelName,
    litellm_params: litellmParams,
  }

  if (normalized.mode) {
    payload.model_info = { mode: normalized.mode }
  }

  return {
    payload,
    normalized,
  }
}

export async function createLiteLLMModel(input: UpsertLiteLLMModelInput): Promise<void> {
  const { payload, normalized } = buildUpsertPayload(input)
  const normalizedModelName = normalized.modelName

  if (normalizedModelName) {
    try {
      const existingIds = await findLiteLLMModelIdsByName(normalizedModelName)
      if (existingIds.length > 0) {
        await updateLiteLLMModel(input)
        return
      }
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error
      }
    }
  }

  await callLiteLLMPostWithFallback(['/model/new', '/v1/model/new'], payload)
  syncLiteLLMModelSecret(normalized)
}

export async function updateLiteLLMModel(input: UpsertLiteLLMModelInput): Promise<void> {
  const { payload, normalized } = buildUpsertPayload(input)
  const normalizedModelName = normalized.modelName

  if (normalizedModelName) {
    try {
      const [modelId] = await findLiteLLMModelIdsByName(normalizedModelName)
      if (modelId) {
        payload.model_info = {
          ...normalizeObject(payload.model_info),
          id: modelId,
        }

        const encodedModelId = encodeURIComponent(modelId)
        try {
          await callLiteLLMPatchWithFallback(
            [
              `/model/${encodedModelId}/update`,
              `/v1/model/${encodedModelId}/update`,
            ],
            payload,
          )
          syncLiteLLMModelSecret(normalized)
          return
        } catch (error) {
          if (!(error instanceof ValidationError)) {
            throw error
          }
        }
      }
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error
      }
    }
  }

  try {
    await callLiteLLMPostWithFallback(['/model/update', '/v1/model/update'], payload)
    syncLiteLLMModelSecret(normalized)
    return
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw error
    }
  }

  await callLiteLLMPostWithFallback(['/model/new', '/v1/model/new'], payload)
  syncLiteLLMModelSecret(normalized)
}

export async function deleteLiteLLMModel(modelName: string): Promise<void> {
  const normalized = normalizeString(modelName)
  if (!normalized) {
    throw new ValidationError('modelName is required')
  }

  let modelIds: string[] = []
  try {
    modelIds = await findLiteLLMModelIdsByName(normalized)
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw error
    }
  }

  if (modelIds.length > 0) {
    let deletedCount = 0

    for (const modelId of modelIds) {
      try {
        await callLiteLLMPostWithFallback(['/model/delete', '/v1/model/delete'], { id: modelId })
        deletedCount += 1
      } catch (error) {
        if (error instanceof ValidationError) {
          continue
        }
        throw error
      }
    }

    if (deletedCount > 0) {
      deleteLiteLLMModelSecret(normalized)
      return
    }
  }

  await callLiteLLMPostWithFallback(
    ['/model/delete', '/v1/model/delete'],
    { model_name: normalized },
  )
  deleteLiteLLMModelSecret(normalized)
}
