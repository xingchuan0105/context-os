import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import {
  getKnowledgeBaseById,
  deleteKnowledgeBase,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@/lib/api/errors'

type NotebookResponse = {
  id: string
  name: string
  description: string
  archived: boolean
  created: string
  updated: string
  source_count: number
  note_count: number
}

const getCounts = (kbId: string) => {
  const sourceRow = db
    .prepare('SELECT COUNT(1) as count FROM document_notebooks WHERE kb_id = ?')
    .get(kbId) as { count: number } | undefined
  const noteRow = db
    .prepare('SELECT COUNT(1) as count FROM notes WHERE kb_id = ?')
    .get(kbId) as { count: number } | undefined
  return { sourceCount: sourceRow?.count ?? 0, noteCount: noteRow?.count ?? 0 }
}

// GET /api/notebooks/{id}
export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { id } = await params
    const kb = await getKnowledgeBaseById(id)
    if (!kb || kb.user_id !== user.id) {
      throw new NotFoundError('Notebook')
    }

    const { sourceCount, noteCount } = getCounts(id)
    const response: NotebookResponse = {
      id: kb.id,
      name: kb.title,
      description: kb.description || '',
      archived: false,
      created: kb.created_at,
      updated: kb.created_at,
      source_count: sourceCount,
      note_count: noteCount,
    }

    return NextResponse.json(response)
  }
)

// PUT /api/notebooks/{id}
export const PUT = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { id } = await params
    const kb = await getKnowledgeBaseById(id)
    if (!kb || kb.user_id !== user.id) {
      throw new NotFoundError('Notebook')
    }

    const body = await req.json()
    const { name, description } = body
    if (name != null && typeof name !== 'string') {
      throw new ValidationError('name must be a string', { field: 'name' })
    }
    if (description != null && typeof description !== 'string') {
      throw new ValidationError('description must be a string', { field: 'description' })
    }

    db.prepare(
      `
      UPDATE knowledge_bases
      SET title = COALESCE(?, title),
          description = COALESCE(?, description)
      WHERE id = ? AND user_id = ?
    `
    ).run(name ?? null, description ?? null, id, user.id)

    const updated = await getKnowledgeBaseById(id)
    if (!updated) {
      throw new NotFoundError('Notebook')
    }

    const { sourceCount, noteCount } = getCounts(id)
    const response: NotebookResponse = {
      id: updated.id,
      name: updated.title,
      description: updated.description || '',
      archived: false,
      created: updated.created_at,
      updated: updated.created_at,
      source_count: sourceCount,
      note_count: noteCount,
    }

    return NextResponse.json(response)
  }
)

// DELETE /api/notebooks/{id}
export const DELETE = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { id } = await params
    const linkedRow = db
      .prepare(
        `
        SELECT d.id
        FROM documents d
        INNER JOIN document_notebooks dn ON dn.doc_id = d.id
        WHERE d.kb_id = ?
        GROUP BY d.id
        HAVING COUNT(dn.kb_id) > 1
        LIMIT 1
      `
      )
      .get(id) as { id: string } | undefined

    if (linkedRow) {
      throw new ValidationError('Notebook has sources referenced by other notebooks', {
        field: 'notebook_id',
      })
    }

    const success = await deleteKnowledgeBase(id, user.id)
    if (!success) {
      throw new NotFoundError('Notebook')
    }

    return NextResponse.json({ success: true })
  }
)
