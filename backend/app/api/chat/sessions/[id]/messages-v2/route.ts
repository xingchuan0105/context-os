/**
 * Chat Messages API V2 - Vercel AI SDK Compatible
 * POST /api/chat/sessions/:id/messages-v2 - 发送消息（Vercel AI SDK 流式响应）
 */

import { NextRequest } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { db } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import {
  buildStep3AnswerSystemPrompt,
  formatEvidenceCardsForPrompt,
  runAgenticPlannerLoop,
} from '@/lib/rag/agentic'
import type { Citation } from '@/lib/types/chat'
import { resolveCapabilityConfig, resolveCapabilityClientOverrides } from '@/lib/admin/model-config-resolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface SendMessageRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  sourceId?: string
  selectedSourceIds?: string[]  // For notebook chat (multiple sources)
  notesContext?: string  // Additional context from notes
  systemPrompt?: string
  model?: string
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await context.params
  console.log('[Chat V2 POST] Request received for session:', sessionId)

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

    const { messages, sourceId, selectedSourceIds, notesContext, systemPrompt, model }: SendMessageRequest = await req.json()

    // Get the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMessage) {
      return new Response(JSON.stringify({ error: 'No user message found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userMessage = lastUserMessage.content

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

    // Check session exists
    const session: any = db
      .prepare(
        `SELECT id, kb_id as kbId, user_id as userId, title
        FROM chat_sessions
        WHERE id = ? AND user_id = ?`
      )
      .get(sessionId, user.id)

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Update session updated_at
    db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      sessionId
    )

    // Save user message
    const userMessageResult = db
      .prepare(
        `INSERT INTO chat_messages (session_id, role, content, created_at)
        VALUES (?, ?, ?, ?)`
      )
      .run(sessionId, 'user', userMessage, new Date().toISOString())
    const userMessageId = Number(userMessageResult.lastInsertRowid)

    const chatOverrides = resolveCapabilityClientOverrides('chat')
    // Create OpenAI-compatible client via capability config
    const openai = createOpenAI({
      baseURL: chatOverrides.baseURL || 'http://localhost:4000/v1',
      apiKey: chatOverrides.apiKey || 'local-dev',
      headers: chatOverrides.defaultHeaders,
    })

    const modelKey = typeof model === 'string' && model.trim() ? model.trim() : 'qwen3-max'

    // Check if we need RAG
    // Support both single sourceId (source chat) and selectedSourceIds array (notebook chat)
    const sourceIds = selectedSourceIds && selectedSourceIds.length > 0
      ? selectedSourceIds
      : (sourceId ? [sourceId] : [])
    const needsRAG = session.kbId || sourceIds.length > 0

    let finalSystemPrompt = systemPrompt || ''

    // Add notes context if provided
    if (notesContext) {
      finalSystemPrompt = finalSystemPrompt
        ? `${finalSystemPrompt}\n\n${notesContext}`
        : notesContext
    }

    let citations: Citation[] = []

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        if (needsRAG) {
          console.log('[Chat V2] Starting RAG retrieval')
          writer.write({
            type: 'data-status',
            data: { status: 'retrieving' },
            transient: true,
          })

          writer.write({
            type: 'data-status',
            data: { status: 'planning' },
            transient: true,
          })

          const plannerResult = await runAgenticPlannerLoop({
            userId: session.userId,
            userQuery: userMessage,
            fullOntologySummary: '',
            kbId: session.kbId,
            documentIds: sourceIds,
          })

          const globalSummary =
            plannerResult.appendFullSummary
              ? plannerResult.fullOntologySummary
              : plannerResult.state.summary_capsule

          finalSystemPrompt = buildStep3AnswerSystemPrompt({
            userQuery: userMessage,
            globalSummary: globalSummary || '(none)',
            retrievedChunks: formatEvidenceCardsForPrompt(plannerResult.evidence),
          })
          citations = buildAgenticCitations(plannerResult.evidence)

          if (citations.length > 0) {
            writer.write({
              type: 'data-citations',
              data: { citations: JSON.parse(JSON.stringify(citations)) },
              transient: true,
            })
          }
        }

        // Build messages for LLM
        const llmMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

        if (finalSystemPrompt) {
          llmMessages.push({ role: 'system', content: finalSystemPrompt })
        }

        // Add conversation history (last 10 messages)
        const historyRaw = db
          .prepare(
            `SELECT role, content
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT 10`
          )
          .all(sessionId) as Array<{ role: string; content: string }>

        const history = historyRaw.reverse()
        for (const msg of history) {
          llmMessages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })
        }

        // Stream the response
        console.log('[Chat V2] Starting streamText with model:', modelKey)
        writer.write({
          type: 'data-status',
          data: { status: 'generating' },
          transient: true,
        })

        const result = streamText({
          model: openai.chat(modelKey),
          messages: llmMessages,
          onFinish: async ({ text }) => {
            console.log('[Chat V2] onFinish called, text length:', text.length)
            writer.write({
              type: 'data-status',
              data: { status: 'saving' },
              transient: true,
            })

            // Save assistant message to database
            const now = new Date().toISOString()
            const assistantMessageResult = db
              .prepare(
                `INSERT INTO chat_messages (session_id, role, content, citations, created_at)
                VALUES (?, ?, ?, ?, ?)`
              )
              .run(
                sessionId,
                'assistant',
                text,
                citations.length > 0 ? JSON.stringify(citations) : null,
                now
              )
            const assistantMessageId = Number(assistantMessageResult.lastInsertRowid)
            console.log('[Chat V2] Assistant message saved with ID:', assistantMessageId)

            writer.write({
              type: 'data-message-ids',
              data: { messageId: assistantMessageId, userMessageId },
              transient: true,
            })
          },
        })

        writer.merge(result.toUIMessageStream())
      },
    })

    return createUIMessageStreamResponse({ stream })
  } catch (error) {
    console.error('[Chat V2] Error:', error)
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
