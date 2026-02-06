import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getDocumentById } from '@/lib/db/queries'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
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

    const progress = doc.status === 'completed' ? 100 : 0
    return NextResponse.json({ status: doc.status, progress })
  } catch (error) {
    console.error('Get document status error:', error)
    return NextResponse.json({ error: 'Failed to get document status' }, { status: 500 })
  }
}
