import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  createQuickNote,
  getQuickNotesByUserId,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
} from '@/lib/api/errors'
import { uploadMarkdownToCOS } from '@/lib/storage/cos'
import {
  shouldUseLocalStorage,
  uploadMarkdownToLocal,
} from '@/lib/storage/local'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type QuickNoteMessage = {
  role: 'user' | 'assistant'
  content: string
}

type QuickNoteSaveRequest = {
  messages?: QuickNoteMessage[]
  label?: string
  locale?: 'zh' | 'en'
}

const QUICK_NOTE_BUCKET = 'quick-notes'

const pad2 = (value: number) => String(value).padStart(2, '0')

const formatTimestamp = (locale: 'zh' | 'en') => {
  const now = new Date()
  return now.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const buildFileName = () => {
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(
    now.getDate()
  )}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  return `quick-note-${stamp}.md`
}

const normalizeMessages = (messages: QuickNoteMessage[]) =>
  messages
    .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant'))
    .map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content.trim() : '',
    }))
    .filter((msg) => msg.content.length > 0)

const buildMarkdown = (
  label: string,
  messages: QuickNoteMessage[],
  locale: 'zh' | 'en'
) => {
  const titlePrefix = locale === 'zh' ? '\u968F\u624B\u8BB0' : 'Quick Note'
  const timePrefix = locale === 'zh' ? '\u65F6\u95F4\uFF1A' : 'Time: '
  const dialogueLabel = locale === 'zh' ? '\u5BF9\u8BDD' : 'Dialogue'
  const roleLabel = (role: QuickNoteMessage['role']) =>
    role === 'user' ? 'User' : 'AI'

  const body = messages
    .map((msg) => `[${roleLabel(msg.role)}] ${msg.content}`)
    .join('\n\n')

  return [
    `# ${titlePrefix} \u00B7 ${label}`,
    `${timePrefix}${formatTimestamp(locale)}`,
    '',
    `## ${dialogueLabel}`,
    '',
    body,
  ].join('\n')
}

const buildPreview = (markdown: string, locale: 'zh' | 'en') => {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('\u65F6\u95F4') && !line.startsWith('Time'))
    .map((line) => line.replace(/^\[(User|AI)\]\s*/i, ''))

  const preview = lines.join(' ')
  const maxLength = locale === 'zh' ? 120 : 180
  return preview.length > maxLength ? `${preview.slice(0, maxLength)}...` : preview
}

const resolveLocale = (req?: NextRequest): 'zh' | 'en' => {
  const header = req?.headers.get('accept-language')?.toLowerCase() || ''
  return header.includes('en') ? 'en' : 'zh'
}

// GET /api/quick-notes
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const locale = resolveLocale(req)
  const notes = await getQuickNotesByUserId(user.id)
  const data = notes.map((note) => ({
    id: note.id,
    label: note.label,
    preview: buildPreview(note.content, locale),
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  }))

  return NextResponse.json(data)
})

// POST /api/quick-notes
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  let body: QuickNoteSaveRequest
  try {
    body = (await req.json()) as QuickNoteSaveRequest
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  const locale = body.locale === 'en' ? 'en' : 'zh'
  const messages = normalizeMessages(body.messages || [])
  if (messages.length === 0) {
    throw new ValidationError('messages is required', { field: 'messages' })
  }

  const label =
    typeof body.label === 'string' && body.label.trim()
      ? body.label.trim()
      : messages.find((msg) => msg.role === 'user')?.content.slice(0, 20) ||
        (locale === 'zh' ? '\u968F\u624B\u8BB0' : 'Quick Note')

  const markdown = buildMarkdown(label, messages, locale)
  const fileName = buildFileName()

  const useLocal = shouldUseLocalStorage()
  const uploadResult = useLocal
    ? await uploadMarkdownToLocal(user.id, QUICK_NOTE_BUCKET, fileName, markdown)
    : await uploadMarkdownToCOS(user.id, QUICK_NOTE_BUCKET, fileName, markdown)

  const stored = await createQuickNote(
    user.id,
    label,
    markdown,
    fileName,
    uploadResult.path
  )

  return NextResponse.json(
    {
      id: stored.id,
      label: stored.label,
      preview: buildPreview(stored.content, locale),
      createdAt: stored.created_at,
      updatedAt: stored.updated_at,
    },
    { status: 201 }
  )
})
