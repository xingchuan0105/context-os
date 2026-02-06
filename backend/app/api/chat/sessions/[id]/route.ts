/**
 * Chat Session Detail API
 * GET /api/chat/sessions/:id - 获取会话详情
 * DELETE /api/chat/sessions/:id - 删除会话
 * PATCH /api/chat/sessions/:id - 更新会话
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/schema'

export const runtime = 'nodejs'

/**
 * 获取会话详情
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const session = db
      .prepare(
        `
        SELECT id, kb_id as kbId, user_id as userId, title, summary, created_at as createdAt, updated_at as updatedAt
        FROM chat_sessions
        WHERE id = ?
      `
      )
      .get(id)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // 获取会话的消息
    const messages = db
      .prepare(
        `
        SELECT id, session_id as sessionId, role, content, citations, created_at as createdAt
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `
      )
      .all(id)

    // 解析 citations JSON
    const parsedMessages = messages.map((msg: any) => ({
      ...msg,
      citations: msg.citations ? JSON.parse(msg.citations) : undefined,
    }))

    return NextResponse.json({ session, messages: parsedMessages })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

/**
 * 删除会话
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // 检查会话是否存在
    const session = db
      .prepare('SELECT id FROM chat_sessions WHERE id = ?')
      .get(id)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // 删除会话（消息会通过外键级联删除）
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}

/**
 * 更新会话（标题等）
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const { title, summary } = await req.json()

    // 检查会话是否存在
    const session = db
      .prepare('SELECT id FROM chat_sessions WHERE id = ?')
      .get(id)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // 更新会话
    const updates: string[] = []
    const values: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      values.push(title)
    }
    if (summary !== undefined) {
      updates.push('summary = ?')
      values.push(summary)
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())

    values.push(id)

    db.prepare(
      `UPDATE chat_sessions SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values)

    // 返回更新后的会话
    const updatedSession = db
      .prepare(
        `
        SELECT id, kb_id as kbId, user_id as userId, title, summary, created_at as createdAt, updated_at as updatedAt
        FROM chat_sessions
        WHERE id = ?
      `
      )
      .get(id)

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}
