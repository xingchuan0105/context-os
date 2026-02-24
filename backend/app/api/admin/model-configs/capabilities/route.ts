import { withErrorHandler, success } from '@/lib/api/errors'
import { requireSuperAdmin } from '@/lib/auth/admin'
import { CAPABILITY_META, MODEL_CAPABILITIES } from '@/lib/admin/capabilities'

export const GET = withErrorHandler(async () => {
  await requireSuperAdmin()

  return success({
    capabilities: MODEL_CAPABILITIES.map((capability) => CAPABILITY_META[capability]),
  })
})
