/**
 * Chat Sessions API
 * GET /api/chat/sessions?kb_id=xxx - 获取会话列表
 * POST /api/chat/sessions - 创建新会话
 */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db/schema'
import { v4 as uuidv4 } from 'uuid'
import { getCurrentUser } from '@/lib/auth/session'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ValidationError,
} from '@/lib/api/errors'

export const runtime = 'nodejs'

/**
 * 获取会话列表
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('请先登录')
  }

  const { searchParams } = new URL(req.url)
  const kbId = searchParams.get('kb_id') || searchParams.get('notebook_id')

  if (!kbId) {
    throw new ValidationError('kb_id is required', { field: 'kb_id' })
  }

  const sessions = db
    .prepare(
      `
      SELECT id, kb_id as kbId, user_id as userId, title, summary, created_at as createdAt, updated_at as updatedAt
      FROM chat_sessions
      WHERE kb_id = ? AND user_id = ?
      ORDER BY updated_at DESC
    `
    )
    .all(kbId, user.id)

  return success({ sessions })
})

/**
 * 创建新会话
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('请先登录')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  if (!body || typeof body !== 'object') {
    throw new ValidationError('Invalid JSON body')
  }

  const { kbId, kb_id, notebook_id, title } = body as {
    kbId?: string
    kb_id?: string
    notebook_id?: string
    title?: string
  }
  const resolvedKbId = kbId ?? kb_id ?? notebook_id

  if (!resolvedKbId) {
    throw new ValidationError('kb_id is required', { field: 'kb_id' })
  }

  const sessionId = uuidv4()
  const now = new Date().toISOString()

  // 默认标题
  const sessionTitle = title || '新对话'

  db.prepare(
    `
    INSERT INTO chat_sessions (id, kb_id, user_id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(sessionId, resolvedKbId, user.id, sessionTitle, now, now)

  const session = db
    .prepare(
      `
      SELECT id, kb_id as kbId, user_id as userId, title, summary, created_at as createdAt, updated_at as updatedAt
      FROM chat_sessions
      WHERE id = ?
    `
    )
    .get(sessionId)

  return success({ session }, 201)
})
