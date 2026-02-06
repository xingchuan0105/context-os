import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import { getKnowledgeBaseById } from '@/lib/db/queries'
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@/lib/api/errors'

type NoteResponse = {
  id: string
  title: string | null
  content: string | null
  note_type: string | null
  created: string
  updated: string
}

const mapNoteRow = (row: {
  id: string
  title: string | null
  content: string | null
  note_type: string | null
  created_at: string
  updated_at: string
}): NoteResponse => ({
  id: row.id,
  title: row.title,
  content: row.content,
  note_type: row.note_type,
  created: row.created_at,
  updated: row.updated_at,
})

// GET /api/notes?notebook_id=xxx
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { searchParams } = new URL(req.url)
  const notebookId = searchParams.get('notebook_id')

  if (notebookId) {
    const kb = await getKnowledgeBaseById(notebookId)
    if (!kb || kb.user_id !== user.id) {
      throw new NotFoundError('Notebook')
    }
  }

  const rows = notebookId
    ? db.prepare(
        `
        SELECT id, title, content, note_type, created_at, updated_at
        FROM notes
        WHERE user_id = ? AND kb_id = ?
        ORDER BY updated_at DESC
      `
      ).all(user.id, notebookId)
    : db.prepare(
        `
        SELECT id, title, content, note_type, created_at, updated_at
        FROM notes
        WHERE user_id = ?
        ORDER BY updated_at DESC
      `
      ).all(user.id)

  const data = (rows as Array<{
    id: string
    title: string | null
    content: string | null
    note_type: string | null
    created_at: string
    updated_at: string
  }>).map(mapNoteRow)

  return NextResponse.json(data)
})

// POST /api/notes
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const body = await req.json()
  const { notebook_id: notebookId, title, content, note_type: noteType } = body

  if (!notebookId || typeof notebookId !== 'string') {
    throw new ValidationError('notebook_id is required', { field: 'notebook_id' })
  }
  if (!content || typeof content !== 'string') {
    throw new ValidationError('content is required', { field: 'content' })
  }

  const kb = await getKnowledgeBaseById(notebookId)
  if (!kb || kb.user_id !== user.id) {
    throw new NotFoundError('Notebook')
  }

  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(
    `
    INSERT INTO notes (id, kb_id, user_id, title, content, note_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    notebookId,
    user.id,
    typeof title === 'string' ? title : null,
    content,
    typeof noteType === 'string' ? noteType : 'human',
    now,
    now
  )

  const created = db.prepare(
    `
    SELECT id, title, content, note_type, created_at, updated_at
    FROM notes
    WHERE id = ? AND user_id = ?
  `
  ).get(id, user.id) as {
    id: string
    title: string | null
    content: string | null
    note_type: string | null
    created_at: string
    updated_at: string
  } | undefined

  if (!created) {
    throw new NotFoundError('Note')
  }

  return NextResponse.json(mapNoteRow(created), { status: 201 })
})
