import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { deleteDocumentComment } from '@/lib/db/queries'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  NotFoundError,
} from '@/lib/api/errors'

// DELETE - 删除评论
export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { id: commentId } = await params

    // 删除评论（只能删除自己的评论）
    const deleted = await deleteDocumentComment(commentId, user.id)

    if (!deleted) {
      throw new NotFoundError('Comment not found or you do not have permission to delete it')
    }

    return success({ message: 'Comment deleted successfully' })
  }
)
