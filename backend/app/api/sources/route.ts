import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  createDocument,
  getDocumentsByNotebookId,
  getDocumentsByUserId,
  getKnowledgeBaseById,
  type Document,
} from '@/lib/db/queries'
import { uploadMarkdownToCOS } from '@/lib/storage/cos'
import { uploadMarkdownToLocal, shouldUseLocalStorage, textToBase64 } from '@/lib/storage/local'
import {
  parseFile,
  parseWebPage,
  toMarkdownFileName,
  formatAsMarkdown,
  isSupportedFormat,
} from '@/lib/parsers'
import { validateFileType } from '@/lib/utils/file-validation'
import { runSemchunk } from '@/lib/semchunk'
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  getRequestId,
} from '@/lib/api/errors'
import { withConcurrencyLimit } from '@/lib/api/concurrency'
import { checkRateLimit, getClientKey } from '@/lib/api/limits'
import { ENV } from '@/lib/config/env-helpers'
import {
  mapDocumentToSource,
  mapDocumentToSourceDetail,
  processDocumentInBackground,
} from './helpers'

// 使用统一的环境变量配置
const UPLOAD_MAX_BYTES = ENV.UPLOAD_MAX_BYTES
const UPLOAD_CONCURRENCY_LIMIT = ENV.UPLOAD_CONCURRENCY_LIMIT
const UPLOAD_RATE_LIMIT_MAX = ENV.UPLOAD_RATE_LIMIT_MAX
const UPLOAD_RATE_LIMIT_WINDOW_MS = ENV.UPLOAD_RATE_LIMIT_WINDOW_MS

const KTYPE_MAX_TOKENS = ENV.KTYPE_MAX_TOKENS
const KTYPE_THRESHOLD = ENV.KTYPE_THRESHOLD
const KTYPE_CHUNK_SIZE = ENV.KTYPE_CHUNK_SIZE
const KTYPE_OVERLAP = ENV.KTYPE_OVERLAP

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

const resolveNotebookId = (formData: FormData) => {
  const notebookId = formData.get('notebook_id')
  const kbId = formData.get('kb_id')
  const notebooksRaw = formData.get('notebooks')
  if (typeof notebookId === 'string' && notebookId) return notebookId
  if (typeof kbId === 'string' && kbId) return kbId
  if (typeof notebooksRaw === 'string' && notebooksRaw) {
    try {
      const parsed = JSON.parse(notebooksRaw)
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return parsed[0]
      }
    } catch {
      return null
    }
  }
  return null
}

const createDocumentsFromContent = async ({
  userId,
  kbId,
  originalName,
  content,
  metadata,
  autoProcess,
}: {
  userId: string
  kbId: string
  originalName: string
  content: string
  metadata?: Record<string, unknown>
  autoProcess: boolean
}): Promise<Document[]> => {
  let parts: string[] = []
  try {
    parts = (await runSemchunk({ text: content }, KTYPE_MAX_TOKENS)) as string[]
  } catch {
    parts = splitForKType(content)
  }

  if (parts.length === 0) {
    parts = [content]
  }

  const baseName = toMarkdownFileName(originalName).replace(/\.md$/i, '')
  const useLocal = shouldUseLocalStorage()
  const createdDocs: Document[] = []

  for (let i = 0; i < parts.length; i++) {
    const partLabel = parts.length > 1 ? `#part-${i + 1}-of-${parts.length}` : ''
    const mdFileName = `${baseName}${partLabel}.md`
    const markdownContent = formatAsMarkdown(
      parts[i],
      parts.length > 1 ? `${originalName} ${partLabel}` : originalName,
      metadata
    )

    const uploadResult = useLocal
      ? await uploadMarkdownToLocal(userId, kbId, mdFileName, markdownContent)
      : await uploadMarkdownToCOS(userId, kbId, mdFileName, markdownContent)

    const base64Content = uploadResult.base64Content || textToBase64(markdownContent)
    const doc = await createDocument(
      kbId,
      userId,
      mdFileName,
      uploadResult.path,
      base64Content,
      'text/markdown',
      Buffer.byteLength(markdownContent, 'utf-8')
    )

    createdDocs.push(doc)

    if (autoProcess) {
      await processDocumentInBackground(doc.id)
    }
  }

  return createdDocs
}

// GET /api/sources?notebook_id=xxx
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { searchParams } = new URL(req.url)
  const notebookId = searchParams.get('notebook_id') || searchParams.get('kb_id')
  const limitRaw = searchParams.get('limit')
  const offsetRaw = searchParams.get('offset')
  const sortBy = (searchParams.get('sort_by') || 'created').toLowerCase()
  const sortOrder = (searchParams.get('sort_order') || 'desc').toLowerCase()
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : null
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : null
  const order = sortOrder === 'asc' ? 'asc' : 'desc'
  const orderBy = sortBy === 'updated' ? 'created_at' : 'created_at'

  let docs: Document[] = []

  if (notebookId) {
    const kb = await getKnowledgeBaseById(notebookId)
    if (!kb || kb.user_id !== user.id) {
      throw new NotFoundError('Notebook')
    }

    docs = await getDocumentsByNotebookId(notebookId, {
      limit: limit && limit > 0 ? limit : undefined,
      offset: offset && offset >= 0 ? offset : undefined,
      orderBy,
      order,
    })
  } else {
    docs = await getDocumentsByUserId(user.id, {
      limit: limit && limit > 0 ? limit : undefined,
      offset: offset && offset >= 0 ? offset : undefined,
      orderBy,
      order,
    })
  }

  const data = docs
    .filter((doc) => doc.user_id === user.id)
    .map((doc) => mapDocumentToSource(doc))

  return NextResponse.json(data)
})

// POST /api/sources
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
    const notebookId = resolveNotebookId(formData)
    if (!notebookId) {
      throw new ValidationError('notebook_id is required', { field: 'notebook_id' })
    }

    const kb = await getKnowledgeBaseById(notebookId)
    if (!kb || kb.user_id !== user.id) {
      throw new NotFoundError('Notebook')
    }

    const typeRaw = formData.get('type')
    const type = typeof typeRaw === 'string' ? typeRaw : null
    const content = typeof formData.get('content') === 'string' ? String(formData.get('content')) : ''
    const title = typeof formData.get('title') === 'string' ? String(formData.get('title')) : ''
    const url = typeof formData.get('url') === 'string' ? String(formData.get('url')) : ''
    const file = formData.get('file') as File | null
    const asyncProcessingValue = formData.get('async_processing')
    const disableProcessing = process.env.DISABLE_ASYNC_PROCESSING === '1'
    const autoProcess = asyncProcessingValue !== 'false' && !disableProcessing

    const resolvedType = type || (file ? 'upload' : content ? 'text' : url ? 'link' : null)
    if (!resolvedType) {
      throw new ValidationError('source type is required', { field: 'type' })
    }

    let extractedText = ''
    let originalName = title || 'Source'
    let metadata: Record<string, unknown> = { source_type: resolvedType }

    if (resolvedType === 'upload') {
      if (!file) {
        throw new ValidationError('file is required for upload', { field: 'file' })
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

      originalName = file.name
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 使用 Magic Bytes 验证实际文件内容
      const validation = validateFileType(buffer, file.type, file.name)
      if (!validation.valid) {
        throw new ValidationError('File content does not match declared type', {
          reason: validation.reason,
          actualType: validation.actualMimeType,
          declaredType: file.type,
        })
      }
      const parseResult = await parseFile(buffer, file.type, file.name)
      extractedText = parseResult.content
      metadata = { ...metadata, ...parseResult.metadata }
    } else if (resolvedType === 'text') {
      if (!content.trim()) {
        throw new ValidationError('content is required', { field: 'content' })
      }
      const contentSize = Buffer.byteLength(content, 'utf-8')
      if (UPLOAD_MAX_BYTES > 0 && contentSize > UPLOAD_MAX_BYTES) {
        throw new ValidationError('Content too large', {
          maxBytes: UPLOAD_MAX_BYTES,
          size: contentSize,
        })
      }
      originalName = title || 'Pasted Text'
      extractedText = content
    } else if (resolvedType === 'link') {
      if (!url.trim()) {
        throw new ValidationError('url is required', { field: 'url' })
      }
      let parsedUrl: URL
      try {
        parsedUrl = new URL(url)
      } catch {
        throw new ValidationError('Invalid url', { url })
      }
      const parseResult = await parseWebPage(parsedUrl.toString())
      extractedText = parseResult.content
      metadata = { ...metadata, source_url: parsedUrl.toString(), ...parseResult.metadata }
      originalName = title || parsedUrl.hostname || 'Website'
    } else {
      throw new ValidationError('Unsupported source type', { type: resolvedType })
    }

    if (!extractedText.trim()) {
      throw new ValidationError('Empty content')
    }

    const docs = await createDocumentsFromContent({
      userId: user.id,
      kbId: notebookId,
      originalName,
      content: extractedText,
      metadata,
      autoProcess,
    })

    if (!docs.length) {
      throw new ValidationError('Failed to create source')
    }

    const response = mapDocumentToSourceDetail(docs[0])
    return NextResponse.json(response, { status: 201 })
  })
})
