import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getDocumentById } from '@/lib/db/queries'
import {
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
} from '@/lib/api/errors'

interface Params {
  params: Promise<{ id: string }>
}

const statusMessage = (status: string | null, error?: string | null) => {
  if (error) return error
  switch (status) {
    case 'queued':
      return 'Queued for processing'
    case 'processing':
      return 'Processing'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    default:
      return 'Unknown'
  }
}

const statusProgress = (status: string | null) => {
  switch (status) {
    case 'queued':
    case 'new':
      return 15
    case 'processing':
    case 'running':
      return 60
    case 'completed':
      return 100
    case 'failed':
      return 100
    default:
      return 0
  }
}

export const GET = withErrorHandler(async (_req: NextRequest, { params }: Params) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await params
  const doc = await getDocumentById(id)
  if (!doc || doc.user_id !== user.id) {
    throw new NotFoundError('Source')
  }

  const status = doc.status || 'completed'
  const message = statusMessage(status, doc.error_message || undefined)
  const progress = statusProgress(status)

  return NextResponse.json({
    status,
    message,
    processing_info: {
      ...(doc.error_message ? { error: doc.error_message } : {}),
      progress,
    },
  })
})
