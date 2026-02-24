import { withErrorHandler, success } from '@/lib/api/errors'
import { requireSuperAdmin } from '@/lib/auth/admin'
import {
  CAPABILITY_META,
  MODEL_CAPABILITIES,
  isLiteLLMEnforcedCapability,
} from '@/lib/admin/capabilities'
import { resolveCapabilityConfig } from '@/lib/admin/model-config-resolver'

export const GET = withErrorHandler(async () => {
  await requireSuperAdmin()

  const capabilities = MODEL_CAPABILITIES.map((capability) => {
    const resolved = resolveCapabilityConfig(capability)
    return {
      capability,
      meta: CAPABILITY_META[capability],
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
    }
  })

  return success({ capabilities })
})
