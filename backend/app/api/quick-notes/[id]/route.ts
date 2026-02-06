import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  deleteQuickNote,
  getQuickNoteById,
  getQuickNoteByIdForUser,
} from '@/lib/db/queries'
import {
  NotFoundError,
  UnauthorizedError,
  withErrorHandler,
} from '@/lib/api/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/quick-notes/:id
export const GET = withErrorHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await context.params
  const paramId = typeof id === 'string' ? id : ''
  const pathId = req.nextUrl.pathname.split('/').pop() || ''
  const noteId = (paramId || pathId).trim()
  let note = noteId
    ? await getQuickNoteByIdForUser(noteId, user.id)
    : null

  if (!note && noteId) {
    const fallback = await getQuickNoteById(noteId)
    if (fallback && fallback.user_id === user.id) {
      note = fallback
    }
  }
  if (!note) {
    throw new NotFoundError('Quick note')
  }

  return NextResponse.json({
    id: note.id,
    label: note.label,
    content: note.content,
    fileName: note.file_name,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  })
})

// DELETE /api/quick-notes/:id
export const DELETE = withErrorHandler(async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await context.params
  const noteId = id
  const deleted = await deleteQuickNote(noteId, user.id)
  if (!deleted) {
    throw new NotFoundError('Quick note')
  }

  return NextResponse.json({ success: true })
})
