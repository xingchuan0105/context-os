import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
} from '@/lib/api/errors'

// DELETE - 清理缓存
export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  // TODO: 实现实际的缓存清理逻辑
  // 例如：清理临时文件、过期数据等

  return success({
    message: 'Cache cleared successfully',
    clearedAt: new Date().toISOString(),
  })
})
