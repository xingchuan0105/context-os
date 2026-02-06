import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import {
  getKnowledgeBaseShareByToken,
  getKnowledgeBaseById,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/api/errors'

const hasChatPermission = (permissions: string | null | undefined) =>
  (permissions || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === 'chat' || entry === 'full')

// GET /api/shared/:token/source-ids
export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { token } = await params
    const kbShare = await getKnowledgeBaseShareByToken(token)
    if (!kbShare) {
      throw new NotFoundError('Share link not found or has expired')
    }

    if (!hasChatPermission(kbShare.permissions)) {
      throw new ForbiddenError('Chat access is not allowed for this share link')
    }

    const knowledgeBase = await getKnowledgeBaseById(kbShare.kb_id)
    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge base')
    }

    const rows = db
      .prepare(
        `
        SELECT id
        FROM documents
        WHERE kb_id = ?
        ORDER BY created_at DESC
      `
      )
      .all(kbShare.kb_id) as Array<{ id: string }>

    return success({ sourceIds: rows.map((row) => row.id) })
  }
)
