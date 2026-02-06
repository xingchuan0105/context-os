import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  getKnowledgeBaseShareByToken,
  getKnowledgeBaseById,
  getDocumentsByNotebookId,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/api/errors'

const hasFullPermission = (permissions: string | null | undefined) =>
  (permissions || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .includes('full')

// GET /api/shared/:token/sources
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

    if (!hasFullPermission(kbShare.permissions)) {
      throw new ForbiddenError('Source access is not allowed for this share link')
    }

    const knowledgeBase = await getKnowledgeBaseById(kbShare.kb_id)
    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge base')
    }

    const documents = await getDocumentsByNotebookId(kbShare.kb_id)

    return success({ documents })
  }
)
