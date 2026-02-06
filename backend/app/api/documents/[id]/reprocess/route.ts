import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getDocumentById, resetDocumentProcessing, updateDocumentStatus } from '@/lib/db/queries'
import { processDocument } from '@/lib/processors/document-processor'
import { deleteDocumentChunks } from '@/lib/qdrant'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const doc = await getDocumentById(id)
    if (!doc || doc.user_id !== user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (doc.status !== 'failed') {
      return NextResponse.json(
        { error: 'Document is not in failed status' },
        { status: 409 }
      )
    }

    const resetOk = await resetDocumentProcessing(id)
    if (!resetOk) {
      return NextResponse.json({ error: 'Failed to reset document' }, { status: 500 })
    }

    // Run async so the API can return immediately.
    setTimeout(async () => {
      try {
        const current = await getDocumentById(id)
        if (!current) {
          await updateDocumentStatus(id, 'failed', 'Document not found for reprocess')
          return
        }

        try {
          await deleteDocumentChunks(user.id, id)
        } catch (error) {
          console.warn(`[reprocess] failed to clear qdrant chunks docId=${id}`, error)
        }

        await processDocument(current, {}, (progress) => {
          console.log(`[reprocess] ${progress.message} (${progress.progress}%)`)
        })
      } catch (error) {
        console.error(`[reprocess] exception docId=${id}`, error)
        try {
          await updateDocumentStatus(
            id,
            'failed',
            error instanceof Error ? error.message : String(error)
          )
        } catch (updateError) {
          console.error('[reprocess] update status failed', updateError)
        }
      }
    }, 100)

    return NextResponse.json({ documentId: id, status: 'processing' })
  } catch (error) {
    console.error('Reprocess document error:', error)
    return NextResponse.json({ error: 'Failed to reprocess document' }, { status: 500 })
  }
}
