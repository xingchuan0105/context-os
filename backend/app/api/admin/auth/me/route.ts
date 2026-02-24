import { UnauthorizedError, success, withErrorHandler } from '@/lib/api/errors'
import { getCurrentAdmin } from '@/lib/auth/admin'

export const GET = withErrorHandler(async () => {
  const admin = await getCurrentAdmin()

  if (!admin) {
    throw new UnauthorizedError('Admin not logged in')
  }

  return success({
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    },
  })
})
