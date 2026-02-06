import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getDocumentById, updateDocumentStatus } from '@/lib/db/queries'
import { base64ToText } from '@/lib/storage/local'
import {
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/lib/api/errors'
import { extractContentFromMarkdown, processDocumentInBackground } from '../../helpers'

interface Params {
  params: Promise<{ id: string }>
}

export const POST = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await params
  const doc = await getDocumentById(id)
  if (!doc || doc.user_id !== user.id) {
    throw new NotFoundError('Source')
  }

  if (!doc.file_content) {
    throw new ValidationError('Source content is not available for retry')
  }

  let extractedText = ''
  try {
    extractedText = extractContentFromMarkdown(base64ToText(doc.file_content))
  } catch {
    extractedText = ''
  }

  if (!extractedText.trim()) {
    throw new ValidationError('Source content is empty')
  }

  await updateDocumentStatus(doc.id, 'queued')
  await processDocumentInBackground(doc.id)

  return NextResponse.json({ success: true })
})
