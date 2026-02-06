import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import {
  deleteDocument,
  getDocumentById,
  getKnowledgeBaseById,
  getNotebookIdsByDocumentId,
  removeDocumentNotebookLink,
  countDocumentNotebookLinks,
} from '@/lib/db/queries'
import { deleteDocumentChunks } from '@/lib/qdrant'
import {
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/lib/api/errors'
import { mapDocumentToSourceDetail } from '../helpers'

interface Params {
  params: Promise<{ id: string }>
}

export const GET = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await params
  const doc = await getDocumentById(id)
  if (!doc || doc.user_id !== user.id) {
    throw new NotFoundError('Source')
  }

  const notebookIds = await getNotebookIdsByDocumentId(id)
  return NextResponse.json(mapDocumentToSourceDetail(doc, notebookIds))
})

export const PUT = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await params
  const doc = await getDocumentById(id)
  if (!doc || doc.user_id !== user.id) {
    throw new NotFoundError('Source')
  }

  const body = await req.json()
  const { title } = body as { title?: string }

  if (title !== undefined && typeof title !== 'string') {
    throw new ValidationError('title must be a string', { field: 'title' })
  }

  if (typeof title === 'string' && title.trim()) {
    db.prepare('UPDATE documents SET file_name = ? WHERE id = ? AND user_id = ?')
      .run(title.trim(), id, user.id)
  }

  const updated = await getDocumentById(id)
  if (!updated) {
    throw new NotFoundError('Source')
  }

  const notebookIds = await getNotebookIdsByDocumentId(id)
  return NextResponse.json(mapDocumentToSourceDetail(updated, notebookIds))
})

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await params
  const doc = await getDocumentById(id)
  if (!doc || doc.user_id !== user.id) {
    throw new NotFoundError('Source')
  }

  const { searchParams } = new URL(req.url)
  const notebookId = searchParams.get('notebook_id') || searchParams.get('kb_id')

  if (notebookId) {
    const kb = await getKnowledgeBaseById(notebookId)
    if (!kb || kb.user_id !== user.id) {
      throw new NotFoundError('Notebook')
    }

    const removed = await removeDocumentNotebookLink(id, notebookId, user.id)
    if (!removed) {
      throw new NotFoundError('Source')
    }

    const remaining = await countDocumentNotebookLinks(id)
    if (remaining <= 0) {
      try {
        await deleteDocumentChunks(user.id, id)
      } catch (error) {
        console.warn(`[Qdrant] failed to delete vectors for document ${id}:`, error)
      }
      await deleteDocument(id, user.id)
    }

    return NextResponse.json({ success: true })
  }

  const linkCount = await countDocumentNotebookLinks(id)
  if (linkCount > 1) {
    throw new ValidationError('Source is linked to other notebooks', { field: 'notebook_id' })
  }

  try {
    await deleteDocumentChunks(user.id, id)
  } catch (error) {
    console.warn(`[Qdrant] failed to delete vectors for document ${id}:`, error)
  }

  const success = await deleteDocument(id, user.id)
  if (!success) {
    throw new NotFoundError('Source')
  }

  return NextResponse.json({ success: true })
})
