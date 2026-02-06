import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { logInfo } from '@/lib/observability/logger'
import { incrementCounter } from '@/lib/observability/metrics'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@/lib/api/errors'

export const runtime = 'nodejs'

type FeedbackPayload = {
  rating?: string | null
}

const normalizeRating = (value: unknown): 'up' | 'down' | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'up' || normalized === 'down') return normalized
  if (normalized === 'none' || normalized === 'clear' || normalized === 'neutral') return null
  return null
}

export const POST = withErrorHandler(async (
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  const { id } = await context.params
  const messageId = Number(id)
  if (!Number.isInteger(messageId)) {
    throw new ValidationError('message id is invalid', { field: 'id' })
  }

  let body: FeedbackPayload = {}
  try {
    body = (await req.json()) as FeedbackPayload
  } catch {
    body = {}
  }

  const rating = normalizeRating(body.rating)
  if (body.rating !== undefined && body.rating !== null && rating === null) {
    throw new ValidationError('rating must be "up" or "down"', { field: 'rating' })
  }

  const message = db
    .prepare(
      `
      SELECT cm.id
      FROM chat_messages cm
      INNER JOIN chat_sessions cs ON cm.session_id = cs.id
      WHERE cm.id = ? AND cs.user_id = ?
    `
    )
    .get(messageId, user.id)

  if (!message) {
    throw new NotFoundError('Chat message')
  }

  const now = new Date().toISOString()
  if (!rating) {
    db.prepare(
      `
      DELETE FROM chat_message_feedback
      WHERE message_id = ? AND user_id = ?
    `
    ).run(messageId, user.id)

    logInfo('chat_feedback_cleared', { messageId, userId: user.id })
    incrementCounter('chat_feedback', 1, { rating: 'clear' })

    return success({ message_id: messageId, rating: null })
  }

  const feedbackId = uuidv4()
  db.prepare(
    `
    INSERT INTO chat_message_feedback (id, message_id, user_id, rating, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(message_id, user_id) DO UPDATE SET
      rating = excluded.rating,
      updated_at = excluded.updated_at
  `
  ).run(feedbackId, messageId, user.id, rating, now, now)

  logInfo('chat_feedback', { messageId, userId: user.id, rating })
  incrementCounter('chat_feedback', 1, { rating })

  return success({ message_id: messageId, rating })
})
