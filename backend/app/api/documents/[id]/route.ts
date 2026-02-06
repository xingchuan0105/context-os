import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getDocumentById, deleteDocument } from '@/lib/db/queries';
import { deleteDocumentChunks } from '@/lib/qdrant';

interface Params {
  params: Promise<{ id: string }>;
}

// 获取文档详情
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const doc = await getDocumentById(id);
    if (!doc || doc.user_id !== user.id) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json({ error: '获取文档失败' }, { status: 500 });
  }
}

// 删除文档
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    try {
      await deleteDocumentChunks(user.id, id);
    } catch (error) {
      console.warn(`[Qdrant] failed to delete vectors for document ${id}:`, error);
    }

    const success = await deleteDocument(id, user.id);
    if (!success) {
      return NextResponse.json({ error: '文档不存在或无权删除' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: '删除文档失败' }, { status: 500 });
  }
}
