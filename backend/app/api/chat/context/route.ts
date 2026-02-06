import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import { getKnowledgeBaseById } from '@/lib/db/queries'
import { base64ToText } from '@/lib/storage/local'
import { estimateTokens } from '@/lib/semchunk'
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@/lib/api/errors'

export const runtime = 'nodejs'

type ContextConfig = {
  sources?: Record<string, string>
  notes?: Record<string, string>
}

type BuildContextRequest = {
  notebook_id?: string
  kb_id?: string
  kbId?: string
  context_config?: ContextConfig
}

type DocumentRow = {
  id: string
  file_name: string
  file_content: string | null
  ktype_summary: string | null
  deep_summary: string | null
}

type NoteRow = {
  id: string
  title: string | null
  content: string | null
  note_type: string | null
}

const isRecord = (value: unknown): value is Record<string, string> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const normalizeMode = (raw: unknown): string => {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

const isSelectedMode = (mode: string): boolean => {
  return mode !== '' && mode !== 'off' && mode !== 'not in'
}

const isInsightsMode = (mode: string): boolean => mode === 'insights'

const isFullMode = (mode: string): boolean =>
  mode === 'full content' || mode === 'full' || mode === 'full_content'

const safeDecodeContent = (value: string | null): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const base64Pattern = /^[A-Za-z0-9+/=]+$/
  if (trimmed.length % 4 === 0 && base64Pattern.test(trimmed)) {
    try {
      return base64ToText(trimmed)
    } catch {
      return value
    }
  }
  return value
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  let body: BuildContextRequest
  try {
    body = (await req.json()) as BuildContextRequest
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  if (!body || typeof body !== 'object') {
    throw new ValidationError('Invalid JSON body')
  }

  const notebookId = body.notebook_id ?? body.kb_id ?? body.kbId
  if (!notebookId || typeof notebookId !== 'string') {
    throw new ValidationError('notebook_id is required', { field: 'notebook_id' })
  }

  const contextConfig = body.context_config
  if (!contextConfig || typeof contextConfig !== 'object') {
    throw new ValidationError('context_config is required', { field: 'context_config' })
  }

  const kb = await getKnowledgeBaseById(notebookId)
  if (!kb || kb.user_id !== user.id) {
    throw new NotFoundError('Notebook')
  }

  const sourcesConfig = isRecord(contextConfig.sources) ? contextConfig.sources : {}
  const notesConfig = isRecord(contextConfig.notes) ? contextConfig.notes : {}

  const selectedSourceIds = Object.keys(sourcesConfig).filter((id) =>
    isSelectedMode(normalizeMode(sourcesConfig[id]))
  )
  const selectedNoteIds = Object.keys(notesConfig).filter((id) =>
    isSelectedMode(normalizeMode(notesConfig[id]))
  )

  const sourceRows = selectedSourceIds.length
    ? (db
        .prepare(
          `
          SELECT d.id, d.file_name, d.file_content, d.ktype_summary, d.deep_summary
          FROM documents d
          INNER JOIN document_notebooks dn ON dn.doc_id = d.id
          WHERE d.id IN (${selectedSourceIds.map(() => '?').join(',')})
            AND dn.kb_id = ?
            AND d.user_id = ?
            AND dn.user_id = ?
        `
        )
        .all(...selectedSourceIds, notebookId, user.id, user.id) as DocumentRow[])
    : []

  const noteRows = selectedNoteIds.length
    ? (db
        .prepare(
          `
          SELECT id, title, content, note_type
          FROM notes
          WHERE id IN (${selectedNoteIds.map(() => '?').join(',')})
            AND kb_id = ?
            AND user_id = ?
        `
        )
        .all(...selectedNoteIds, notebookId, user.id) as NoteRow[])
    : []

  const sourceMap = new Map<string, DocumentRow>()
  sourceRows.forEach((row) => sourceMap.set(row.id, row))

  const noteMap = new Map<string, NoteRow>()
  noteRows.forEach((row) => noteMap.set(row.id, row))

  const sources = selectedSourceIds
    .map((id) => {
      const row = sourceMap.get(id)
      if (!row) return null
      const mode = normalizeMode(sourcesConfig[id])
      const summary = (row.deep_summary || row.ktype_summary || '').trim()
      const fullContent = safeDecodeContent(row.file_content).trim()
      let content = ''

      if (isInsightsMode(mode)) {
        content = summary || fullContent
      } else if (isFullMode(mode)) {
        content = fullContent || summary
      } else {
        return null
      }

      if (!content) {
        return null
      }

      return {
        id: row.id,
        title: row.file_name,
        mode: isInsightsMode(mode) ? 'insights' : 'full',
        content,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const notes = selectedNoteIds
    .map((id) => {
      const row = noteMap.get(id)
      if (!row) return null
      const mode = normalizeMode(notesConfig[id])
      if (!isSelectedMode(mode)) {
        return null
      }
      const content = (row.content || '').trim()
      if (!content) {
        return null
      }
      return {
        id: row.id,
        title: row.title,
        note_type: row.note_type,
        mode: 'full',
        content,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const contentParts = [
    ...sources.map((item) => item.content),
    ...notes.map((item) => item.content),
  ]

  let charCount = 0
  let tokenCount = 0
  for (const part of contentParts) {
    if (!part) continue
    charCount += part.length
    tokenCount += estimateTokens(part)
  }

  return NextResponse.json({
    context: { sources, notes },
    token_count: tokenCount,
    char_count: charCount,
  })
})
