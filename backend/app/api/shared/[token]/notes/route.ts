import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import {
  getKnowledgeBaseShareByToken,
  getKnowledgeBaseById,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/api/errors'

type NoteRow = {
  id: string
  title: string | null
  content: string | null
  note_type: string | null
  created_at: string
  updated_at: string
}

const mapNoteRow = (row: NoteRow) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  note_type: row.note_type,
  created: row.created_at,
  updated: row.updated_at,
})

const hasFullPermission = (permissions: string | null | undefined) =>
  (permissions || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .includes('full')

// GET /api/shared/:token/notes
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
      throw new ForbiddenError('Note access is not allowed for this share link')
    }

    const knowledgeBase = await getKnowledgeBaseById(kbShare.kb_id)
    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge base')
    }

    const rows = db.prepare(
      `
      SELECT id, title, content, note_type, created_at, updated_at
      FROM notes
      WHERE kb_id = ?
      ORDER BY updated_at DESC
    `
    ).all(kbShare.kb_id) as NoteRow[]

    return success({ notes: rows.map(mapNoteRow) })
  }
)
