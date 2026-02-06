import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  addDocumentNotebookLink,
  countDocumentNotebookLinks,
  deleteDocument,
  getDocumentById,
  getKnowledgeBaseById,
  removeDocumentNotebookLink,
} from '@/lib/db/queries'
import { deleteDocumentChunks } from '@/lib/qdrant'
import {
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
} from '@/lib/api/errors'

interface Params {
  params: Promise<{ id: string; sourceId: string }>
}

// POST /api/notebooks/{id}/sources/{sourceId}
export const POST = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id, sourceId } = await params
  const kb = await getKnowledgeBaseById(id)
  if (!kb || kb.user_id !== user.id) {
    throw new NotFoundError('Notebook')
  }

  const doc = await getDocumentById(sourceId)
  if (!doc || doc.user_id !== user.id) {
    throw new NotFoundError('Source')
  }

  await addDocumentNotebookLink(sourceId, id, user.id)
  return NextResponse.json({ success: true })
})

// DELETE /api/notebooks/{id}/sources/{sourceId}
export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id, sourceId } = await params
  const kb = await getKnowledgeBaseById(id)
  if (!kb || kb.user_id !== user.id) {
    throw new NotFoundError('Notebook')
  }

  const doc = await getDocumentById(sourceId)
  if (!doc || doc.user_id !== user.id) {
    throw new NotFoundError('Source')
  }

  const removed = await removeDocumentNotebookLink(sourceId, id, user.id)
  if (!removed) {
    throw new NotFoundError('Source')
  }

  const remaining = await countDocumentNotebookLinks(sourceId)
  if (remaining <= 0) {
    try {
      await deleteDocumentChunks(user.id, sourceId)
    } catch (error) {
      console.warn(`[Qdrant] failed to delete vectors for document ${sourceId}:`, error)
    }
    await deleteDocument(sourceId, user.id)
  }

  return NextResponse.json({ success: true, deleted: remaining <= 0 })
})
