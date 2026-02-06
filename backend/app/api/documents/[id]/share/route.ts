import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getDocumentById } from '@/lib/db/queries'
import {
  createDocumentShare,
  getDocumentSharesByDocumentId,
  deleteDocumentShare,
  incrementShareAccessCount,
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

// POST - 创建分享链接
export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id: documentId } = await params

  // 检查文档是否存在且属于当前用户
  const document = await getDocumentById(documentId)
  if (!document) {
    throw new NotFoundError('Document not found')
  }
  if (document.user_id !== user.id) {
    throw new UnauthorizedError('You do not have permission to share this document')
  }

  const body = await req.json()
  const { expiryDays = 7, permissions = 'view' } = body

  // 计算过期时间
  let expiresAt: Date | null = null
  if (expiryDays > 0) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiryDays)
  }

  // 创建分享链接
  const share = await createDocumentShare(documentId, user.id, expiresAt, permissions)
  const appUrl = getAppUrl(req)

  return success({
    token: share.token,
    url: `${appUrl}/shared/${share.token}`,
    expiresAt: share.expires_at,
    permissions: share.permissions,
  })
})

// GET - 获取文档的所有分享链接
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id: documentId } = await params

  // 检查文档是否存在且属于当前用户
  const document = await getDocumentById(documentId)
  if (!document) {
    throw new NotFoundError('Document not found')
  }
  if (document.user_id !== user.id) {
    throw new UnauthorizedError('You do not have permission to view shares for this document')
  }

  const shares = await getDocumentSharesByDocumentId(documentId)
  const appUrl = getAppUrl(req)

  return success({
    shares: shares.map(share => ({
      id: share.id,
      token: share.token,
      url: `${appUrl}/shared/${share.token}`,
      expiresAt: share.expires_at,
      accessCount: share.access_count,
      permissions: share.permissions,
      createdAt: share.created_at,
    })),
  })
})
