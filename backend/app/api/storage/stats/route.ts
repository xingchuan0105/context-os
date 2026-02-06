import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
} from '@/lib/api/errors'

// GET - 获取存储统计信息
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  // 获取文档数量和总大小
  const docStats = db
    .prepare(`
      SELECT
        COUNT(*) as documentCount,
        COALESCE(SUM(file_size), 0) as totalSize
      FROM documents
      WHERE user_id = ?
    `)
    .get(user.id) as { documentCount: number; totalSize: number }

  // 获取知识库数量
  const kbCount = db
    .prepare('SELECT COUNT(*) as count FROM knowledge_bases WHERE user_id = ?')
    .get(user.id) as { count: number }

  // 获取对话数量
  const sessionCount = db
    .prepare('SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = ?')
    .get(user.id) as { count: number }

  // 获取笔记数量
  const noteCount = db
    .prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?')
    .get(user.id) as { count: number }

  // 格式化文件大小
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return success({
    storage: {
      used: formatBytes(docStats.totalSize),
      usedBytes: docStats.totalSize,
      documentCount: docStats.documentCount,
      kbCount: kbCount.count,
      sessionCount: sessionCount.count,
      noteCount: noteCount.count,
    },
  })
})
