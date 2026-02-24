import { NextRequest } from 'next/server'
import { success, ValidationError, withErrorHandler } from '@/lib/api/errors'
import { requireSuperAdmin } from '@/lib/auth/admin'
import { listModelConfigAuditLogs } from '@/lib/admin/model-config-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseLimit(req: NextRequest): number {
  const raw = req.nextUrl.searchParams.get('limit')
  if (!raw || !raw.trim()) {
    return 30
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError('limit must be a positive integer', { limit: raw })
  }

  return Math.max(1, Math.min(200, parsed))
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireSuperAdmin()

  const limit = parseLimit(req)
  const logs = listModelConfigAuditLogs(limit)

  return success({ logs })
})
