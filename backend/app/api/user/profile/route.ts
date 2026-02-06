import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db/schema'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ValidationError,
} from '@/lib/api/errors'

// PUT - 更新用户资料
export const PUT = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const body = await req.json()
  const { full_name, email } = body

  // 验证邮箱格式
  if (email && typeof email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format')
    }

    // 检查邮箱是否已被其他用户使用
    const existingUser = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(email, user.id)

    if (existingUser) {
      throw new ValidationError('Email already in use')
    }
  }

  // 构建更新语句
  const updates: string[] = []
  const values: any[] = []

  if (full_name !== undefined) {
    updates.push('full_name = ?')
    values.push(full_name)
  }

  if (email !== undefined) {
    updates.push('email = ?')
    values.push(email)
  }

  if (updates.length === 0) {
    throw new ValidationError('No fields to update')
  }

  values.push(user.id)

  const stmt = db.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  )
  stmt.run(...values)

  // 获取更新后的用户信息
  const updatedUser = db
    .prepare('SELECT id, email, full_name, avatar_url, created_at FROM users WHERE id = ?')
    .get(user.id)

  return success({ user: updatedUser })
})

// GET - 获取当前用户资料
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const userData = db
    .prepare('SELECT id, email, full_name, avatar_url, created_at FROM users WHERE id = ?')
    .get(user.id)

  return success({ user: userData })
})
