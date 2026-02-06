import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
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

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/notes/:id
export const GET = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await params
  const row = db.prepare(
    `
    SELECT id, title, content, note_type, created_at, updated_at
    FROM notes
    WHERE id = ? AND user_id = ?
  `
  ).get(id, user.id) as
    | {
        id: string
        title: string | null
        content: string | null
        note_type: string | null
        created_at: string
        updated_at: string
      }
    | undefined

  if (!row) {
    throw new NotFoundError('Note')
  }

  return NextResponse.json(mapNoteRow(row))
})

// PUT /api/notes/:id
export const PUT = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await params
  const body = await req.json()
  const { title, content, note_type: noteType } = body ?? {}

  if (title !== undefined && typeof title !== 'string') {
    throw new ValidationError('title must be a string', { field: 'title' })
  }
  if (content !== undefined && typeof content !== 'string') {
    throw new ValidationError('content must be a string', { field: 'content' })
  }
  if (noteType !== undefined && typeof noteType !== 'string') {
    throw new ValidationError('note_type must be a string', { field: 'note_type' })
  }

  if (title === undefined && content === undefined && noteType === undefined) {
    throw new ValidationError('No fields to update')
  }

  const updates: string[] = []
  const values: Array<string | null> = []

  if (title !== undefined) {
    updates.push('title = ?')
    values.push(title)
  }
  if (content !== undefined) {
    updates.push('content = ?')
    values.push(content)
  }
  if (noteType !== undefined) {
    updates.push('note_type = ?')
    values.push(noteType)
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())

  const result = db
    .prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...values, id, user.id)

  if (result.changes === 0) {
    throw new NotFoundError('Note')
  }

  const row = db.prepare(
    `
    SELECT id, title, content, note_type, created_at, updated_at
    FROM notes
    WHERE id = ? AND user_id = ?
  `
  ).get(id, user.id) as
    | {
        id: string
        title: string | null
        content: string | null
        note_type: string | null
        created_at: string
        updated_at: string
      }
    | undefined

  if (!row) {
    throw new NotFoundError('Note')
  }

  return NextResponse.json(mapNoteRow(row))
})

// DELETE /api/notes/:id
export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await params
  const result = db
    .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .run(id, user.id)

  if (result.changes === 0) {
    throw new NotFoundError('Note')
  }

  return NextResponse.json({ success: true })
})
