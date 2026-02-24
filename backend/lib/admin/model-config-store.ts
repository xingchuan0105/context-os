import { db } from '@/lib/db/schema'
import { CAPABILITY_META, type ModelCapability, type ProviderMode, MODEL_CAPABILITIES } from './capabilities'
import { decryptSecret, encryptSecret, maskApiKey } from './model-config-security'

export type ModelCapabilityRecord = {
  id: string
  capability: ModelCapability
  enabled: number
  provider_mode: ProviderMode
  base_url: string | null
  api_key_ciphertext: string | null
  api_key_masked: string | null
  model: string | null
  timeout_ms: number | null
  extra_json: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type PublicModelCapabilityConfig = {
  capability: ModelCapability
  enabled: boolean
  providerMode: ProviderMode
  baseUrl: string | null
  apiKeyMasked: string | null
  model: string | null
  timeoutMs: number | null
  extra: Record<string, unknown>
  updatedBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type ModelCapabilityConfigInternal = PublicModelCapabilityConfig & {
  apiKey: string | null
}

function nowISO() {
  return new Date().toISOString()
}

function parseExtra(extraJson: string | null): Record<string, unknown> {
  if (!extraJson) return {}
  try {
    const parsed = JSON.parse(extraJson)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

function toPublic(record: ModelCapabilityRecord | null): PublicModelCapabilityConfig | null {
  if (!record) return null

  return {
    capability: record.capability,
    enabled: Boolean(record.enabled),
    providerMode: record.provider_mode,
    baseUrl: record.base_url,
    apiKeyMasked: record.api_key_masked,
    model: record.model,
    timeoutMs: record.timeout_ms,
    extra: parseExtra(record.extra_json),
    updatedBy: record.updated_by,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

function toInternal(record: ModelCapabilityRecord | null): ModelCapabilityConfigInternal | null {
  if (!record) return null

  return {
    capability: record.capability,
    enabled: Boolean(record.enabled),
    providerMode: record.provider_mode,
    baseUrl: record.base_url,
    apiKey: decryptSecret(record.api_key_ciphertext),
    apiKeyMasked: record.api_key_masked,
    model: record.model,
    timeoutMs: record.timeout_ms,
    extra: parseExtra(record.extra_json),
    updatedBy: record.updated_by,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

export function getModelCapabilityRecord(capability: ModelCapability): ModelCapabilityRecord | null {
  return (
    db
      .prepare('SELECT * FROM admin_model_capability_configs WHERE capability = ?')
      .get(capability) as ModelCapabilityRecord | undefined
  ) || null
}

export function getModelCapabilityConfig(capability: ModelCapability): PublicModelCapabilityConfig | null {
  return toPublic(getModelCapabilityRecord(capability))
}

export function getModelCapabilityConfigInternal(capability: ModelCapability): ModelCapabilityConfigInternal | null {
  return toInternal(getModelCapabilityRecord(capability))
}

export function listModelCapabilityConfigs(): PublicModelCapabilityConfig[] {
  const rows = db
    .prepare('SELECT * FROM admin_model_capability_configs ORDER BY capability ASC')
    .all() as ModelCapabilityRecord[]

  return rows
    .map((row) => toPublic(row))
    .filter((row): row is PublicModelCapabilityConfig => Boolean(row))
}

export type UpsertCapabilityInput = {
  capability: ModelCapability
  enabled?: boolean
  providerMode?: ProviderMode
  baseUrl?: string | null
  model?: string | null
  timeoutMs?: number | null
  extra?: Record<string, unknown> | null
  apiKey?: string | null
  updatedBy?: string | null
}

function insertAuditLog(
  capability: ModelCapability,
  action: 'create' | 'update' | 'test',
  operatorUserId: string | null,
  changedFields: Record<string, unknown>
) {
  db.prepare(
    `INSERT INTO admin_model_config_audit_logs (id, capability, action, changed_fields, operator_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    cryptoRandomId(),
    capability,
    action,
    JSON.stringify(changedFields || {}),
    operatorUserId,
    nowISO()
  )
}

function cryptoRandomId() {
  return `cfg_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`
}

export function upsertModelCapabilityConfig(input: UpsertCapabilityInput): PublicModelCapabilityConfig {
  const existing = getModelCapabilityRecord(input.capability)
  const now = nowISO()

  const existingDecryptedKey = existing?.api_key_ciphertext ? decryptSecret(existing.api_key_ciphertext) : null

  const nextEnabled = input.enabled ?? (existing ? Boolean(existing.enabled) : true)
  const nextProviderMode = input.providerMode ?? existing?.provider_mode ?? CAPABILITY_META[input.capability].defaultProviderMode
  const nextBaseUrl = input.baseUrl === undefined ? (existing?.base_url ?? null) : input.baseUrl
  const nextModel = input.model === undefined ? (existing?.model ?? null) : input.model
  const nextTimeout = input.timeoutMs === undefined ? (existing?.timeout_ms ?? null) : input.timeoutMs
  const nextExtra = input.extra === undefined ? parseExtra(existing?.extra_json ?? null) : (input.extra || {})

  let nextApiKey = existingDecryptedKey
  if (input.apiKey !== undefined) {
    nextApiKey = input.apiKey && input.apiKey.trim() ? input.apiKey.trim() : null
  }

  const nextCiphertext = nextApiKey ? encryptSecret(nextApiKey) : null
  const nextMasked = maskApiKey(nextApiKey)

  const payload = {
    capability: input.capability,
    enabled: nextEnabled ? 1 : 0,
    provider_mode: nextProviderMode,
    base_url: nextBaseUrl,
    api_key_ciphertext: nextCiphertext,
    api_key_masked: nextMasked,
    model: nextModel,
    timeout_ms: nextTimeout,
    extra_json: JSON.stringify(nextExtra),
    updated_by: input.updatedBy || null,
    updated_at: now,
  }

  if (!existing) {
    db.prepare(
      `INSERT INTO admin_model_capability_configs
      (id, capability, enabled, provider_mode, base_url, api_key_ciphertext, api_key_masked, model, timeout_ms, extra_json, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      cryptoRandomId(),
      payload.capability,
      payload.enabled,
      payload.provider_mode,
      payload.base_url,
      payload.api_key_ciphertext,
      payload.api_key_masked,
      payload.model,
      payload.timeout_ms,
      payload.extra_json,
      payload.updated_by,
      now,
      now
    )

    insertAuditLog(input.capability, 'create', input.updatedBy || null, {
      enabled: nextEnabled,
      providerMode: nextProviderMode,
      baseUrlChanged: Boolean(nextBaseUrl),
      modelChanged: Boolean(nextModel),
      timeoutChanged: nextTimeout != null,
      apiKeyUpdated: Boolean(input.apiKey !== undefined),
    })
  } else {
    db.prepare(
      `UPDATE admin_model_capability_configs
       SET enabled = ?, provider_mode = ?, base_url = ?, api_key_ciphertext = ?, api_key_masked = ?, model = ?, timeout_ms = ?, extra_json = ?, updated_by = ?, updated_at = ?
       WHERE capability = ?`
    ).run(
      payload.enabled,
      payload.provider_mode,
      payload.base_url,
      payload.api_key_ciphertext,
      payload.api_key_masked,
      payload.model,
      payload.timeout_ms,
      payload.extra_json,
      payload.updated_by,
      payload.updated_at,
      payload.capability
    )

    insertAuditLog(input.capability, 'update', input.updatedBy || null, {
      enabled: nextEnabled,
      providerMode: nextProviderMode,
      baseUrlChanged: payload.base_url !== existing.base_url,
      modelChanged: payload.model !== existing.model,
      timeoutChanged: payload.timeout_ms !== existing.timeout_ms,
      apiKeyUpdated: Boolean(input.apiKey !== undefined),
    })
  }

  return getModelCapabilityConfig(input.capability) as PublicModelCapabilityConfig
}

export function listAllCapabilitiesWithConfig(): Array<{
  meta: typeof CAPABILITY_META[ModelCapability]
  config: PublicModelCapabilityConfig | null
}> {
  return MODEL_CAPABILITIES.map((capability) => ({
    meta: CAPABILITY_META[capability],
    config: getModelCapabilityConfig(capability),
  }))
}

export function addModelConfigAuditTestLog(
  capability: ModelCapability,
  operatorUserId: string | null,
  payload: Record<string, unknown>
): void {
  insertAuditLog(capability, 'test', operatorUserId, payload)
}

export type ModelConfigAuditLogItem = {
  id: string
  capability: ModelCapability
  action: 'create' | 'update' | 'test'
  changedFields: Record<string, unknown>
  operatorUserId: string | null
  operatorEmail: string | null
  createdAt: string
}

type ModelConfigAuditLogRow = {
  id: string
  capability: string
  action: string
  changed_fields: string | null
  operator_user_id: string | null
  created_at: string
  operator_email: string | null
}

function parseAuditChangedFields(value: string | null): Record<string, unknown> {
  if (!value || !value.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

export function listModelConfigAuditLogs(limit: number = 50): ModelConfigAuditLogItem[] {
  const normalizedLimit = Math.max(1, Math.min(200, Math.floor(limit || 50)))

  const rows = db.prepare(
    `SELECT logs.id,
            logs.capability,
            logs.action,
            logs.changed_fields,
            logs.operator_user_id,
            logs.created_at,
            accounts.email as operator_email
       FROM admin_model_config_audit_logs logs
       LEFT JOIN admin_accounts accounts
         ON accounts.id = logs.operator_user_id
      ORDER BY logs.created_at DESC
      LIMIT ?`
  ).all(normalizedLimit) as ModelConfigAuditLogRow[]

  return rows
    .filter((row) => (MODEL_CAPABILITIES as readonly string[]).includes(row.capability))
    .map((row) => ({
      id: row.id,
      capability: row.capability as ModelCapability,
      action: row.action === 'create' || row.action === 'test' ? row.action : 'update',
      changedFields: parseAuditChangedFields(row.changed_fields),
      operatorUserId: row.operator_user_id,
      operatorEmail: row.operator_email,
      createdAt: row.created_at,
    }))
}
