/**
 * Chat Messages API
 * POST /api/chat/sessions/:id/messages - 发送消息（流式响应）
 */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { createSSEStreamWithSender, getSSEHeaders } from '@/lib/sse/stream-builder'
import { createLLMClientWithOverrides } from '@/lib/llm-client'
import {
  buildStep3AnswerSystemPrompt,
  formatEvidenceCardsForPrompt,
  runAgenticPlannerLoop,
} from '@/lib/rag/agentic'
import type { Citation } from '@/lib/types/chat'
import type OpenAI from 'openai'
import { resolveCapabilityClientOverrides, resolveCapabilityConfig } from '@/lib/admin/model-config-resolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SendMessageRequest {
  message: string
  selectedSourceIds?: string[]
  model?: string
  systemPrompt?: string
}

function buildAgenticCitations(
  cards: Array<{
    chunkId: string
    docId: string
    docName: string
    content: string
    score: number
    source: 'summary' | 'content' | 'meta'
  }>
): Citation[] {
  return cards.map((card, index) => {
    const chunkMatch = card.chunkId.match(/(?:^|#)c(\d{1,6})$/i)
    const chunkIndex = chunkMatch ? Number(chunkMatch[1]) : undefined
    const layer =
      card.source === 'summary'
        ? 'summary'
        : card.source === 'meta'
          ? 'document'
          : 'child'
    return {
      index: index + 1,
      content: card.content,
      docId: card.docId,
      docName: card.docName,
      chunkIndex,
      score: card.score,
      layer,
      metadata: {
        chunkId: card.chunkId,
        source: card.source,
      },
    }
  })
}

/**
 * 发送消息 - 流式响应（支持RAG检索）
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await context.params
  console.log('[Chat POST] Request received for session:', sessionId)

  try {
    const user = await getCurrentUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Please login' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const chatCapability = resolveCapabilityConfig('chat')
    if (!chatCapability.enabled) {
      return new Response(JSON.stringify({ error: 'Chat capability is disabled by admin config' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const chatOverrides = resolveCapabilityClientOverrides('chat')

    const { message, selectedSourceIds, systemPrompt, model }: SendMessageRequest = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const sourceIds = Array.isArray(selectedSourceIds)
      ? selectedSourceIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : []

    const sessionOwner = db
      .prepare('SELECT user_id as userId FROM chat_sessions WHERE id = ?')
      .get(sessionId) as { userId: string } | undefined

    if (!sessionOwner) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (sessionOwner.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 检查会话是否存在
    const session: any = db
      .prepare(
        `
        SELECT id, kb_id as kbId, user_id as userId, title
        FROM chat_sessions
        WHERE id = ? AND user_id = ?
      `
      )
      .get(sessionId, user.id)

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 更新会话 updated_at
    db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      sessionId
    )

    // 保存用户消息
    const userMessageId = db
      .prepare(
        `
        INSERT INTO chat_messages (session_id, role, content, created_at)
        VALUES (?, ?, ?, ?)
      `
      )
      .run(sessionId, 'user', message, new Date().toISOString()).lastInsertRowid

    // 获取会话历史（最近10条）
    const historyRaw = db
      .prepare(
        `
        SELECT role, content
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `
      )
      .all(sessionId) as Array<{ role: string; content: string }>

    const history = historyRaw.reverse()
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    for (const msg of history) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })
    }

    return new Response(
      createSSEStreamWithSender(async (sender) => {
        let fullContent = ''
        const citations: Citation[] = []
        const modelKey = typeof model === 'string' && model.trim() ? model.trim() : 'qwen3_max'
        const client = createLLMClientWithOverrides(modelKey, {
          model: typeof model === 'string' && model.trim() ? undefined : chatOverrides.model,
          apiKey: chatOverrides.apiKey,
          baseURL: chatOverrides.baseURL,
          timeout: chatOverrides.timeout,
          defaultHeaders: chatOverrides.defaultHeaders,
        })

        try {
        sender.start({ timestamp: Date.now() })

        // 发送用户消息确认
        sender.send({ type: 'user', data: { content: message, id: userMessageId } })

        // 只有当没有知识库且没有选择文档时，才跳过 RAG 检索
        console.log('[Chat] Session info:', {
          sessionId,
          kbId: session.kbId,
          userId: session.userId,
          sourceIds,
          willSkipRAG: !session.kbId && sourceIds.length === 0,
        })

        if (!session.kbId && sourceIds.length === 0) {
          console.log('[Chat] Skipping RAG - no kbId and no sourceIds')
          let streamError: unknown = null
          try {
            await client.chatStream(messages, {
              onEvent: (event) => {
                if (event.type === 'delta' && event.content && event.content !== '[FIRST_TOKEN]') {
                  fullContent += event.content
                  sender.token(event.content)
                }
              },
            })
          } catch (error) {
            streamError = error
          }

          if (streamError) {
            if (!fullContent) {
              const { content } = await client.chat(messages)
              fullContent = content
            } else {
              console.warn(
                '[Chat] stream failed after partial output:',
                streamError instanceof Error ? streamError.message : String(streamError)
              )
            }
          }

          const now = new Date().toISOString()
          const assistantMessageId = db
            .prepare(
              `
              INSERT INTO chat_messages (session_id, role, content, citations, created_at)
              VALUES (?, ?, ?, ?, ?)
            `
            )
            .run(
              sessionId,
              'assistant',
              fullContent,
              null,
              now
            ).lastInsertRowid

          sender.done({
            content: fullContent,
            citations,
            id: assistantMessageId,
          })
          return
        }

        // ========== RAG 检索（按测试脚本逻辑）==========
        console.log('[Chat RAG] Starting RAG retrieval:', {
          userId: session.userId,
          kbId: session.kbId,
          sourceIds,
          message: message.slice(0, 100),
        })

        const plannerResult = await runAgenticPlannerLoop({
          userId: session.userId,
          userQuery: message,
          fullOntologySummary: '',
          kbId: session.kbId,
          documentIds: sourceIds,
        })

        const globalSummary = plannerResult.appendFullSummary
          ? plannerResult.fullOntologySummary
          : plannerResult.state.summary_capsule

        citations.push(...buildAgenticCitations(plannerResult.evidence))

        sender.send({
          type: 'search',
          data: {
            count: plannerResult.evidence.length,
            breakdown: {
              document: plannerResult.evidence.filter((item) => item.source === 'summary').length,
              parents: 0,
              children: plannerResult.evidence.filter((item) => item.source === 'content').length,
            },
            documentIds: sourceIds,
          },
        })

        const finalMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
        if (systemPrompt) {
          finalMessages.push({ role: 'system', content: systemPrompt })
        }
        finalMessages.push({
          role: 'system',
          content: buildStep3AnswerSystemPrompt({
            userQuery: message,
            globalSummary: globalSummary || '（无）',
            retrievedChunks: formatEvidenceCardsForPrompt(plannerResult.evidence),
          }),
        })
        finalMessages.push({ role: 'user', content: message })

        let streamError: unknown = null
        try {
          await client.chatStream(finalMessages, {
            onEvent: (event) => {
              if (event.type === 'delta' && event.content && event.content !== '[FIRST_TOKEN]') {
                fullContent += event.content
                sender.token(event.content)
              }
            },
          })
        } catch (error) {
          streamError = error
        }

        if (streamError) {
          if (!fullContent) {
            const { content } = await client.chat(finalMessages)
            fullContent = content
          } else {
            console.warn(
              '[Chat] stream failed after partial output:',
              streamError instanceof Error ? streamError.message : String(streamError)
            )
          }
        }

        // 保存 AI 回复
        const now = new Date().toISOString()
        const assistantMessageId = db
          .prepare(
            `
            INSERT INTO chat_messages (session_id, role, content, citations, created_at)
            VALUES (?, ?, ?, ?, ?)
          `
          )
          .run(
            sessionId,
            'assistant',
            fullContent,
            citations.length > 0 ? JSON.stringify(citations) : null,
            now
          ).lastInsertRowid

        sender.done({
          content: fullContent,
          citations,
          id: assistantMessageId,
        })
        } catch (error) {
          sender.error(error instanceof Error ? error.message : 'Unknown error')
        }
      }),
      { headers: getSSEHeaders() }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
