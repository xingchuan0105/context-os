import { NextRequest } from 'next/server'
import {
  withErrorHandler,
  success,
  ValidationError,
} from '@/lib/api/errors'
import { requireSuperAdmin } from '@/lib/auth/admin'
import {
  CAPABILITY_META,
  isLiteLLMEnforcedCapability,
  isModelCapability,
  type CapabilityModelCategory,
  type ProviderMode,
} from '@/lib/admin/capabilities'
import { listLiteLLMModels } from '@/lib/admin/litellm-models'
import { resolveCapabilityConfig } from '@/lib/admin/model-config-resolver'
import { upsertModelCapabilityConfig } from '@/lib/admin/model-config-store'

const ALLOWED_PROVIDER_MODES: ProviderMode[] = ['litellm', 'direct', 'legacy_oneapi']

type Params = { params: Promise<{ capability: string }> }

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ValidationError('Expected string value')
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false
  }
  throw new ValidationError('enabled must be a boolean')
}

function describeCategory(category: CapabilityModelCategory): string {
  switch (category) {
    case 'llm':
      return 'LLM'
    case 'ocr_vl':
      return 'OCR/VL'
    case 'embedding':
      return 'Embedding'
    case 'rerank':
      return 'Rerank'
    default:
      return '通用'
  }
}

function isCompatibleCategory(required: CapabilityModelCategory, actual: string): boolean {
  if (required === 'none') {
    return true
  }

  if (required === 'llm') {
    return actual === 'llm' || actual === 'other'
  }

  return actual === required
}

async function validateCapabilityModelSelection(params: {
  capability: keyof typeof CAPABILITY_META
  enabled: boolean
  model: string | null
}): Promise<void> {
  const { capability, enabled, model } = params
  const meta = CAPABILITY_META[capability]

  if (!meta.supportsModel || !enabled) {
    return
  }

  if (!model) {
    throw new ValidationError('当前能力已启用，必须选择一个 LiteLLM 模型别名', {
      capability,
    })
  }

  if (!isLiteLLMEnforcedCapability(capability)) {
    return
  }

  const models = await listLiteLLMModels()
  const selected = models.find((item) => item.modelName === model)

  if (!selected) {
    throw new ValidationError('所选模型别名不存在，请先到“模型管理”页创建或刷新后重试', {
      capability,
      model,
    })
  }

  if (!isCompatibleCategory(meta.modelCategory, selected.category)) {
    throw new ValidationError(
      `能力 ${meta.label} 仅允许选择 ${describeCategory(meta.modelCategory)} 分类模型，当前模型分类为 ${selected.category}`,
      {
        capability,
        requiredCategory: meta.modelCategory,
        actualCategory: selected.category,
        model,
      },
    )
  }
}

export const GET = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  await requireSuperAdmin()

  const { capability } = await params
  if (!isModelCapability(capability)) {
    throw new ValidationError('Unsupported capability', { capability })
  }

  const resolved = resolveCapabilityConfig(capability)
  return success({
    capability,
    config: {
      enabled: resolved.enabled,
      providerMode: resolved.providerMode,
      baseUrl: resolved.baseUrl,
      apiKeyMasked: resolved.apiKeyMasked,
      model: resolved.model,
      timeoutMs: resolved.timeoutMs,
      extra: resolved.extra,
      source: resolved.source,
      policy: {
        litellmEnforced: isLiteLLMEnforcedCapability(capability),
      },
    },
  })
})

export const PUT = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const user = await requireSuperAdmin()

  const { capability } = await params
  if (!isModelCapability(capability)) {
    throw new ValidationError('Unsupported capability', { capability })
  }

  const enforceLiteLLMOnly = isLiteLLMEnforcedCapability(capability)

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  const providerModeRaw = body.providerMode
  let providerMode: ProviderMode | undefined
  if (providerModeRaw !== undefined) {
    if (typeof providerModeRaw !== 'string' || !ALLOWED_PROVIDER_MODES.includes(providerModeRaw as ProviderMode)) {
      throw new ValidationError('Invalid providerMode', { providerMode: providerModeRaw })
    }
    providerMode = providerModeRaw as ProviderMode
  }

  if (enforceLiteLLMOnly && providerMode && providerMode !== 'litellm') {
    throw new ValidationError('This capability is enforced to use LiteLLM provider mode')
  }

  const timeoutRaw = body.timeoutMs
  let timeoutMs: number | null | undefined = undefined
  if (timeoutRaw !== undefined) {
    if (timeoutRaw === null || timeoutRaw === '') {
      timeoutMs = null
    } else {
      const parsed = typeof timeoutRaw === 'number' ? timeoutRaw : Number(timeoutRaw)
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ValidationError('timeoutMs must be a non-negative number', { timeoutMs: timeoutRaw })
      }
      timeoutMs = parsed
    }
  }

  const enabled = normalizeOptionalBoolean(body.enabled)

  if (body.extra !== undefined) {
    throw new ValidationError('extra/prompt 属于产品策略配置，不允许在管理后台修改')
  }

  const normalizedBaseUrl = normalizeNullableString(body.baseUrl)
  const normalizedApiKey = normalizeNullableString(body.apiKey)
  const normalizedModel = normalizeNullableString(body.model)

  const currentResolved = resolveCapabilityConfig(capability)
  const nextEnabled = enabled ?? currentResolved.enabled

  await validateCapabilityModelSelection({
    capability,
    enabled: nextEnabled,
    model: normalizedModel === undefined ? currentResolved.model : normalizedModel,
  })

  const updated = upsertModelCapabilityConfig({
    capability,
    enabled,
    providerMode: enforceLiteLLMOnly ? 'litellm' : providerMode,
    baseUrl: enforceLiteLLMOnly ? null : normalizedBaseUrl,
    apiKey: enforceLiteLLMOnly ? null : normalizedApiKey,
    model: normalizedModel,
    timeoutMs,
    updatedBy: user.id,
  })

  return success({ capability, config: updated })
})
