import { NextRequest, NextResponse } from 'next/server';
import { updateDocumentStatus, updateDocumentKType } from '@/lib/db/queries';

/**
 * SCF 文档处理完成回调
 *
 * 当腾讯云 SCF 函数完成文档处理后，调用此接口更新数据库状态
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      docId,
      status,
      errorMessage,
      ktypeSummary,
      ktypeMetadata,
      deepSummary,
      chunkCount,
    } = body;

    // 验证必需参数
    if (!docId || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters: docId, status' },
        { status: 400 }
      );
    }

    // 更新文档状态
    if (status === 'completed') {
      // 处理成功，更新K-Type结果
      if (!ktypeSummary || !chunkCount) {
        return NextResponse.json(
          { error: 'Missing K-Type data for completed status' },
          { status: 400 }
        );
      }

      await updateDocumentKType(
        docId,
        ktypeSummary,
        ktypeMetadata || '{}',
        deepSummary || '{}',
        chunkCount
      );

      console.log(`✅ 文档处理完成: docId=${docId}, chunks=${chunkCount}`);
    } else if (status === 'failed') {
      // 处理失败
      await updateDocumentStatus(docId, 'failed', errorMessage || '未知错误');
      console.error(`❌ 文档处理失败: docId=${docId}, error=${errorMessage}`);
    } else {
      // 其他状态（processing等）
      await updateDocumentStatus(docId, status, errorMessage);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.json(
      { error: '回调处理失败' },
      { status: 500 }
    );
  }
}
