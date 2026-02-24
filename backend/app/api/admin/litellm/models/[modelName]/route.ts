import { NextRequest } from 'next/server'
import { success, ValidationError, withErrorHandler } from '@/lib/api/errors'
import { requireSuperAdmin } from '@/lib/auth/admin'
import {
  deleteLiteLLMModel,
  listLiteLLMModels,
  migrateLiteLLMSecretsFromEnv,
  resolveLiteLLMModelSecret,
  updateLiteLLMModel,
  type UpsertLiteLLMModelInput,
} from '@/lib/admin/litellm-models'

type Params = { params: Promise<{ modelName: string }> }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseUpdatePayload(
  modelName: string,
  body: Record<string, unknown>,
): UpsertLiteLLMModelInput {
  const litellmModel = typeof body.litellmModel === 'string' ? body.litellmModel : ''
  const apiBase = typeof body.apiBase === 'string' ? body.apiBase : null
  const apiKey = body.apiKey === null || typeof body.apiKey === 'string' ? body.apiKey : undefined
  const clearApiKey = body.clearApiKey === true
  const mode = typeof body.mode === 'string' ? body.mode : null

  return {
    modelName,
    litellmModel,
    apiBase,
    apiKey,
    clearApiKey,
    mode,
  }
}

export const GET = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  await requireSuperAdmin()

  const { modelName } = await params
  if (!modelName || !modelName.trim()) {
    throw new ValidationError('modelName is required')
  }

  await migrateLiteLLMSecretsFromEnv(modelName).catch(() => undefined)

  const secret = await resolveLiteLLMModelSecret(modelName)
  return success({
    modelName,
    hasApiKey: Boolean(secret?.apiKey),
    apiKey: secret?.apiKey || null,
    apiKeyMasked: secret?.apiKeyMasked || null,
    source: secret?.source || null,
    envVar: secret?.envVar || null,
  })
})

export const PUT = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  await requireSuperAdmin()

  const { modelName } = await params
  if (!modelName || !modelName.trim()) {
    throw new ValidationError('modelName is required')
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  await updateLiteLLMModel(parseUpdatePayload(modelName, body))
  const models = await listLiteLLMModels()
  return success({ models })
})

export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  await requireSuperAdmin()

  const { modelName } = await params
  if (!modelName || !modelName.trim()) {
    throw new ValidationError('modelName is required')
  }

  await deleteLiteLLMModel(modelName)
  const models = await listLiteLLMModels()
  return success({ models })
})
