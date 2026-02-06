import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getDocumentById } from '@/lib/db/queries'
import { base64ToBuffer } from '@/lib/storage/local'
import { downloadFileFromCOS } from '@/lib/storage/cos'
import {
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
} from '@/lib/api/errors'

interface Params {
  params: Promise<{ id: string }>
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

  let buffer: Buffer | null = null
  if (doc.file_content) {
    buffer = base64ToBuffer(doc.file_content)
  } else if (doc.storage_path && !doc.storage_path.startsWith('local://')) {
    buffer = await downloadFileFromCOS(doc.storage_path)
  }

  if (!buffer) {
    throw new NotFoundError('File')
  }

  const contentType = doc.mime_type || 'text/markdown'
  const fileName = doc.file_name || `source-${doc.id}.md`

  const body = Uint8Array.from(buffer)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
})
