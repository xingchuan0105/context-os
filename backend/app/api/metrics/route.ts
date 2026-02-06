import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getMetricsSnapshot } from '@/lib/observability/metrics'
import { ForbiddenError, UnauthorizedError, success, withErrorHandler } from '@/lib/api/errors'

export const GET = withErrorHandler(async (_req: NextRequest) => {
  if (process.env.METRICS_ENABLED !== 'true') {
    throw new ForbiddenError('Metrics disabled')
  }

  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  return success(getMetricsSnapshot())
})
