import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  getKnowledgeBaseById,
  revokeKnowledgeBaseShare,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  NotFoundError,
} from '@/lib/api/errors'

// DELETE - revoke share link
export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; shareId: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { id: kbId, shareId } = await params
    const knowledgeBase = await getKnowledgeBaseById(kbId)
    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge base')
    }
    if (knowledgeBase.user_id !== user.id) {
      throw new UnauthorizedError('You do not have permission to revoke this share link')
    }

    const revoked = await revokeKnowledgeBaseShare(shareId, kbId, user.id)
    if (!revoked) {
      throw new NotFoundError('Share link')
    }

    return success({ success: true })
  }
)
