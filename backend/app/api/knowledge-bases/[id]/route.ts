import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db/schema';
import {
  getKnowledgeBaseById,
  deleteKnowledgeBase,
  getDocumentsByNotebookId,
} from '@/lib/db/queries';

interface Params {
  params: Promise<{ id: string }>;
}

// 获取单个知识库详情
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const kb = await getKnowledgeBaseById(id);
    if (!kb || kb.user_id !== user.id) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const documents = await getDocumentsByNotebookId(id);

    return NextResponse.json({ ...kb, documents });
  } catch (error) {
    console.error('Get knowledge base error:', error);
    return NextResponse.json({ error: '获取知识库失败' }, { status: 500 });
  }
}

// 删除知识库
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const linkedRow = db
      .prepare(
        `
        SELECT d.id
        FROM documents d
        INNER JOIN document_notebooks dn ON dn.doc_id = d.id
        WHERE d.kb_id = ?
        GROUP BY d.id
        HAVING COUNT(dn.kb_id) > 1
        LIMIT 1
      `
      )
      .get(id) as { id: string } | undefined;

    if (linkedRow) {
      return NextResponse.json(
        { error: 'Notebook has sources referenced by other notebooks' },
        { status: 400 }
      );
    }

    const success = await deleteKnowledgeBase(id, user.id);
    if (!success) {
      return NextResponse.json({ error: '知识库不存在或无权删除' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete knowledge base error:', error);
    return NextResponse.json({ error: '删除知识库失败' }, { status: 500 });
  }
}
