import { success, withErrorHandler } from '@/lib/api/errors'
import { deleteAdminSession } from '@/lib/auth/admin'

export const POST = withErrorHandler(async () => {
  await deleteAdminSession()
  return success({ success: true })
})
