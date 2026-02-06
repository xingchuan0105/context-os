import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import {
  createKnowledgeBase,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
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

const resolveOrderBy = (raw: string | null) => {
  if (!raw) return { field: 'created_at', direction: 'DESC' }
  const parts = raw.toLowerCase().split(/\s+/).filter(Boolean)
  const fieldMap: Record<string, string> = {
    updated: 'created_at',
    created: 'created_at',
    name: 'title',
  }
  const field = fieldMap[parts[0]] || 'created_at'
  const direction = parts[1] === 'asc' ? 'ASC' : 'DESC'
  return { field, direction }
}

// GET /api/notebooks
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { searchParams } = new URL(req.url)
  const { field, direction } = resolveOrderBy(searchParams.get('order_by'))

  const stmt = db.prepare(
    `
    SELECT
      kb.id as id,
      kb.title as name,
      COALESCE(kb.description, '') as description,
      kb.created_at as created,
      kb.created_at as updated,
      (SELECT COUNT(1) FROM document_notebooks dn WHERE dn.kb_id = kb.id) as source_count,
      (SELECT COUNT(1) FROM notes n WHERE n.kb_id = kb.id) as note_count
    FROM knowledge_bases kb
    WHERE kb.user_id = ?
    ORDER BY ${field} ${direction}
  `
  )
  const rows = stmt.all(user.id) as Omit<NotebookResponse, 'archived'>[]
  const data: NotebookResponse[] = rows.map((row) => ({
    ...row,
    archived: false,
  }))

  return NextResponse.json(data)
})

// POST /api/notebooks
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const body = await req.json()
  const { name, description } = body

  if (!name || typeof name !== 'string') {
    throw new ValidationError('name is required', { field: 'name' })
  }

  const kb = await createKnowledgeBase(user.id, name, undefined, description)
  const response: NotebookResponse = {
    id: kb.id,
    name: kb.title,
    description: kb.description || '',
    archived: false,
    created: kb.created_at,
    updated: kb.created_at,
    source_count: 0,
    note_count: 0,
  }

  return NextResponse.json(response, { status: 201 })
})
