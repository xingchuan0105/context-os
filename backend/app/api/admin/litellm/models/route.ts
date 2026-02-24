import { NextRequest } from 'next/server'
import { success, ValidationError, withErrorHandler } from '@/lib/api/errors'
import { requireSuperAdmin } from '@/lib/auth/admin'
import {
  createLiteLLMModel,
  listLiteLLMModels,
  migrateLiteLLMSecretsFromEnv,
  type UpsertLiteLLMModelInput,
} from '@/lib/admin/litellm-models'
import { isLiteLLMEnforcementEnabled } from '@/lib/admin/capabilities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseCreatePayload(body: Record<string, unknown>): UpsertLiteLLMModelInput {
  const modelName = typeof body.modelName === 'string' ? body.modelName : ''
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

export const GET = withErrorHandler(async () => {
  await requireSuperAdmin()

  await migrateLiteLLMSecretsFromEnv().catch(() => undefined)

  const models = await listLiteLLMModels()
  return success({
    policy: {
      allCapabilitiesViaLiteLLM: isLiteLLMEnforcementEnabled(),
    },
    models,
  })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireSuperAdmin()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  await createLiteLLMModel(parseCreatePayload(body))
  const models = await listLiteLLMModels()
  return success({ models })
})
