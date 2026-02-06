import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getDocumentById } from '@/lib/db/queries'
import {
  createDocumentComment,
  getCommentsByDocumentId,
  deleteDocumentComment,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@/lib/api/errors'

// GET - 获取文档的所有评论
export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id: documentId } = await params

  // 检查文档是否存在
  const document = await getDocumentById(documentId)
  if (!document) {
    throw new NotFoundError('Document not found')
  }

  // 获取评论
  const comments = await getCommentsByDocumentId(documentId)

  return success({
    comments: comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      author: {
        id: comment.user_id,
        username: comment.username,
        email: comment.email,
      },
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    })),
  })
})

// POST - 创建新评论
export const POST = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id: documentId } = await params

  // 检查文档是否存在
  const document = await getDocumentById(documentId)
  if (!document) {
    throw new NotFoundError('Document not found')
  }

  const body = await req.json()
  const { content } = body

  if (!content || typeof content !== 'string') {
    throw new ValidationError('Content is required')
  }

  if (content.trim().length === 0) {
    throw new ValidationError('Content cannot be empty')
  }

  if (content.length > 5000) {
    throw new ValidationError('Content is too long (max 5000 characters)')
  }

  // 创建评论
  const comment = await createDocumentComment(documentId, user.id, content.trim())

  return success({
    comment: {
      id: comment.id,
      content: comment.content,
      author: {
        id: user.id,
        username: user.full_name || user.email,
        email: user.email,
      },
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    },
  })
})
