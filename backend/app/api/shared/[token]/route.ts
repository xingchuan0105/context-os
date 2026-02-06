import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  getDocumentShareByToken,
  incrementShareAccessCount,
  getDocumentById,
  getKnowledgeBaseShareByToken,
  incrementKnowledgeBaseShareAccessCount,
  getKnowledgeBaseById,
} from '@/lib/db/queries'
import {
  withErrorHandler,
  success,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/api/errors'

// GET - 访问分享链接
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw new UnauthorizedError('Please login')
    }

    const { token } = await params

    const kbShare = await getKnowledgeBaseShareByToken(token)
    if (kbShare) {
      const permissions = kbShare.permissions || ''
      const canChat = permissions
        .split(',')
        .map(entry => entry.trim().toLowerCase())
        .some(entry => entry === 'chat' || entry === 'full')
      if (!canChat) {
        throw new ForbiddenError('Chat access is not allowed for this share link')
      }

      const knowledgeBase = await getKnowledgeBaseById(kbShare.kb_id)
      if (!knowledgeBase) {
        throw new NotFoundError('Knowledge base')
      }

      await incrementKnowledgeBaseShareAccessCount(token)

      return success({
        type: 'knowledge_base',
        knowledgeBase: {
          id: knowledgeBase.id,
          title: knowledgeBase.title,
          description: knowledgeBase.description,
          createdAt: knowledgeBase.created_at,
        },
        share: {
          permissions: kbShare.permissions,
          expiresAt: kbShare.expires_at,
        },
      })
    }

    // 获取分享记录
    const share = await getDocumentShareByToken(token)
    if (!share) {
      throw new NotFoundError('Share link not found or has expired')
    }

    // 获取文档信息
    const document = await getDocumentById(share.document_id)
    if (!document) {
      throw new NotFoundError('Document not found')
    }

    // 增加访问计数
    await incrementShareAccessCount(token)

    return success({
      type: 'document',
      document: {
        id: document.id,
        title: document.file_name,
        content: document.file_content,
        ktypeSummary: document.ktype_summary,
        deepSummary: document.deep_summary,
        createdAt: document.created_at,
      },
      share: {
        permissions: share.permissions,
        expiresAt: share.expires_at,
      },
    })
  }
)
