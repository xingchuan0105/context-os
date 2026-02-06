import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  getKnowledgeBaseById,
  createKnowledgeBaseShare,
  getKnowledgeBaseSharesByKbId,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@/lib/api/errors'

const getAppUrl = (req: NextRequest) =>
  req.headers.get('origin') ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'

const parseExpiryDays = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const parseExpiresAt = (value: unknown): Date | null => {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

// POST - create share link
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { id: kbId } = await params
    const knowledgeBase = await getKnowledgeBaseById(kbId)
    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge base')
    }
    if (knowledgeBase.user_id !== user.id) {
      throw new UnauthorizedError('You do not have permission to share this knowledge base')
    }

    const body = await req.json()
    const requestedPermissions =
      typeof body?.permissions === 'string' && body.permissions.trim() !== ''
        ? body.permissions.trim().toLowerCase()
        : 'chat'

    if (requestedPermissions !== 'chat' && requestedPermissions !== 'full') {
      throw new ValidationError('Unsupported permissions', { field: 'permissions' })
    }

    const rawExpiresAt = body?.expiresAt
    let expiresAt: Date | null = parseExpiresAt(rawExpiresAt)
    if (rawExpiresAt && !expiresAt) {
      throw new ValidationError('Invalid expiresAt', { field: 'expiresAt' })
    }

    if (!expiresAt) {
      const rawExpiryDays = body?.expiryDays
      const expiryDays = parseExpiryDays(rawExpiryDays)
      if (rawExpiryDays != null && expiryDays == null) {
        throw new ValidationError('expiryDays must be a number', { field: 'expiryDays' })
      }
      if (expiryDays != null) {
        if (expiryDays < 0) {
          throw new ValidationError('expiryDays must be >= 0', { field: 'expiryDays' })
        }
        if (expiryDays > 0) {
          expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + expiryDays)
        }
      }
    }

    const share = await createKnowledgeBaseShare(
      kbId,
      user.id,
      expiresAt,
      requestedPermissions
    )
    const appUrl = getAppUrl(req)

    return success({
      id: share.id,
      kbId: kbId,
      token: share.token,
      url: `${appUrl}/share/${share.token}`,
      expiresAt: share.expires_at,
      permissions: share.permissions,
      createdAt: share.created_at,
    })
  }
)

// GET - list share links for a knowledge base
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { id: kbId } = await params
    const knowledgeBase = await getKnowledgeBaseById(kbId)
    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge base')
    }
    if (knowledgeBase.user_id !== user.id) {
      throw new UnauthorizedError('You do not have permission to view shares for this knowledge base')
    }

    const shares = await getKnowledgeBaseSharesByKbId(kbId)
    const appUrl = getAppUrl(req)

    return success({
      shares: shares.map(share => ({
        id: share.id,
        kbId: share.kb_id,
        token: share.token,
        url: `${appUrl}/share/${share.token}`,
        expiresAt: share.expires_at,
        accessCount: share.access_count,
        permissions: share.permissions,
        revokedAt: share.revoked_at,
        createdAt: share.created_at,
      })),
    })
  }
)
