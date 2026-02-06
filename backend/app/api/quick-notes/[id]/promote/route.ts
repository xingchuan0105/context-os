import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  createDocument,
  getKnowledgeBaseById,
  getQuickNoteById,
  getQuickNoteByIdForUser,
} from '@/lib/db/queries'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  withErrorHandler,
} from '@/lib/api/errors'
import { uploadMarkdownToCOS } from '@/lib/storage/cos'
import {
  shouldUseLocalStorage,
  textToBase64,
  uploadMarkdownToLocal,
} from '@/lib/storage/local'
import { mapDocumentToSourceDetail, processDocumentInBackground } from '@/app/api/sources/helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PromoteRequest = {
  notebook_id?: string
  kb_id?: string
}

const resolveNotebookId = (body: PromoteRequest) =>
  typeof body.notebook_id === 'string' && body.notebook_id
    ? body.notebook_id
    : typeof body.kb_id === 'string' && body.kb_id
      ? body.kb_id
      : null

// POST /api/quick-notes/:id/promote
export const POST = withErrorHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  let body: PromoteRequest
  try {
    body = (await req.json()) as PromoteRequest
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  const notebookId = resolveNotebookId(body)
  if (!notebookId) {
    throw new ValidationError('notebook_id is required', { field: 'notebook_id' })
  }

  const kb = await getKnowledgeBaseById(notebookId)
  if (!kb || kb.user_id !== user.id) {
    throw new NotFoundError('Notebook')
  }

  const { id } = await context.params
  const paramId = typeof id === 'string' ? id : ''
  const pathId = req.nextUrl.pathname.split('/').slice(-2)[0] || ''
  const noteId = (paramId || pathId).trim()
  let quickNote = noteId
    ? await getQuickNoteByIdForUser(noteId, user.id)
    : null

  if (!quickNote && noteId) {
    const fallback = await getQuickNoteById(noteId)
    if (fallback && fallback.user_id === user.id) {
      quickNote = fallback
    }
  }
  if (!quickNote) {
    throw new NotFoundError('Quick note')
  }

  const markdown = quickNote.content
  const fileName = quickNote.file_name || `quick-note-${noteId}.md`
  const fileSize = Buffer.byteLength(markdown, 'utf-8')

  const useLocal = shouldUseLocalStorage()
  const uploadResult = useLocal
    ? await uploadMarkdownToLocal(user.id, notebookId, fileName, markdown)
    : await uploadMarkdownToCOS(user.id, notebookId, fileName, markdown)

  const base64Content = uploadResult.base64Content || textToBase64(markdown)
  const doc = await createDocument(
    notebookId,
    user.id,
    fileName,
    uploadResult.path,
    base64Content,
    'text/markdown',
    fileSize
  )

  await processDocumentInBackground(doc.id)

  return NextResponse.json(mapDocumentToSourceDetail(doc), { status: 201 })
})
