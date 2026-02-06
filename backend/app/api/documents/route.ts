import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  createDocument,
  getDocumentsByNotebookId,
} from '@/lib/db/queries'
import { uploadMarkdownToCOS } from '@/lib/storage/cos'
import {
  uploadMarkdownToLocal,
  shouldUseLocalStorage,
  textToBase64,
} from '@/lib/storage/local'
import { enqueueDocumentIngest } from '@/lib/queue'
import { runSemchunk } from '@/lib/semchunk'
import { parseFile, toMarkdownFileName, formatAsMarkdown, isSupportedFormat } from '@/lib/parsers'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ValidationError,
  getRequestId,
} from '@/lib/api/errors'
import { withConcurrencyLimit } from '@/lib/api/concurrency'
import { checkRateLimit, getClientKey } from '@/lib/api/limits'

const UPLOAD_MAX_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || String(50 * 1024 * 1024), 10)
const UPLOAD_CONCURRENCY_LIMIT = parseInt(process.env.UPLOAD_CONCURRENCY_LIMIT || '2', 10)
const UPLOAD_RATE_LIMIT_MAX = parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '0', 10)
const UPLOAD_RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || '60000',
  10
)

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { searchParams } = new URL(req.url)
  const kbId = searchParams.get('kb_id')

  if (!kbId) {
    throw new ValidationError('Missing kb_id')
  }

  const documents = await getDocumentsByNotebookId(kbId)
  return success(documents)
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  if (UPLOAD_RATE_LIMIT_MAX > 0) {
    const key = `upload:${user.id}:${getClientKey(req)}`
    const rate = await checkRateLimit(key, UPLOAD_RATE_LIMIT_MAX, UPLOAD_RATE_LIMIT_WINDOW_MS)
    if (!rate.allowed) {
      throw new ValidationError('Rate limit exceeded', {
        resetAt: new Date(rate.resetAt).toISOString(),
        limit: UPLOAD_RATE_LIMIT_MAX,
      })
    }
  }

  const requestId = getRequestId(req)

  return await withConcurrencyLimit('upload', UPLOAD_CONCURRENCY_LIMIT, async () => {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const kbId = formData.get('kb_id') as string
    const autoProcess = formData.get('autoProcess') !== 'false'

    if (!file || !kbId) {
      throw new ValidationError('Missing file or kb_id', {
        file: !file ? 'file is required' : undefined,
        kbId: !kbId ? 'kb_id is required' : undefined,
      })
    }

    if (!isSupportedFormat(file.type, file.name)) {
      throw new ValidationError('Unsupported file type', {
        fileType: file.type,
        fileName: file.name,
      })
    }

    if (file.size <= 0) {
      throw new ValidationError('Empty file upload')
    }

    if (UPLOAD_MAX_BYTES > 0 && file.size > UPLOAD_MAX_BYTES) {
      throw new ValidationError('File too large', {
        maxBytes: UPLOAD_MAX_BYTES,
        size: file.size,
      })
    }

    console.log(`[upload] requestId=${requestId} file=${file.name} size=${file.size}`)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const parseResult = await parseFile(buffer, file.type, file.name)
    console.log(`[upload] parsed ${parseResult.content.length} chars`)

    const KTYPE_MAX_TOKENS = parseInt(process.env.KTYPE_MAX_TOKENS || '500000', 10)
    const KTYPE_THRESHOLD = 900000
    const KTYPE_CHUNK_SIZE = 500000
    const KTYPE_OVERLAP = 10000

    const splitForKType = (text: string): string[] => {
      if (text.length <= KTYPE_THRESHOLD) return [text]
      const chunks: string[] = []
      const chunkCount = Math.max(1, Math.ceil(text.length / KTYPE_CHUNK_SIZE))
      const step = KTYPE_CHUNK_SIZE - KTYPE_OVERLAP
      for (let i = 0; i < chunkCount; i++) {
        const start = i === 0 ? 0 : i * step
        const end = i === chunkCount - 1 ? text.length : start + KTYPE_CHUNK_SIZE
        chunks.push(text.slice(start, Math.min(text.length, end)))
      }
      return chunks
    }

    let parts: string[] = []
    try {
      parts = (await runSemchunk({ text: parseResult.content }, KTYPE_MAX_TOKENS)) as string[]
    } catch (error) {
      console.warn('[upload] semchunk failed, fallback to length split:', error)
      parts = splitForKType(parseResult.content)
    }

    if (parts.length === 0) {
      parts = [parseResult.content]
    }

    const baseName = toMarkdownFileName(file.name).replace(/\.md$/i, '')
    const useLocal = shouldUseLocalStorage()
    const createdDocs = []

    for (let i = 0; i < parts.length; i++) {
      const partLabel = parts.length > 1 ? `#part-${i + 1}-of-${parts.length}` : ''
      const mdFileName = `${baseName}${partLabel}.md`
      const markdownContent = formatAsMarkdown(
        parts[i],
        parts.length > 1 ? `${file.name} ${partLabel}` : file.name,
        parseResult.metadata
      )

      const uploadResult = useLocal
        ? await uploadMarkdownToLocal(user.id, kbId, mdFileName, markdownContent)
        : await uploadMarkdownToCOS(user.id, kbId, mdFileName, markdownContent)

      const base64Content = uploadResult.base64Content || textToBase64(markdownContent)
      const doc = await createDocument(
        kbId,
        user.id,
        mdFileName,
        uploadResult.path,
        base64Content,
        'text/markdown',
        Buffer.byteLength(markdownContent, 'utf-8')
      )

      createdDocs.push({ ...doc, url: uploadResult.url })
      console.log(`[upload] created document record docId=${doc.id}`)

      if (autoProcess) {
        await enqueueDocumentIngest(doc.id)
      }
    }

    return success(
      {
        document: createdDocs[0],
        documents: createdDocs,
        autoProcessTriggered: autoProcess,
        message: autoProcess
          ? 'Upload parsed successfully, processing started'
          : 'Upload parsed successfully',
      },
      201
    )
  })
})

