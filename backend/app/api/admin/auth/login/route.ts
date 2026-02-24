import { NextRequest } from 'next/server'
import {
  UnauthorizedError,
  ValidationError,
  success,
  withErrorHandler,
} from '@/lib/api/errors'
import { authenticateAdmin, createAdminSession } from '@/lib/auth/admin'

export const POST = withErrorHandler(async (req: NextRequest) => {
  let body: { email?: string; password?: string }

  try {
    body = (await req.json()) as { email?: string; password?: string }
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    throw new ValidationError('邮箱和密码必填')
  }

  const admin = await authenticateAdmin(email, password)
  if (!admin) {
    throw new UnauthorizedError('邮箱或密码错误')
  }

  await createAdminSession(admin)

  return success({
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    },
  })
})
