/**
 * Chat Messages API V2 - Vercel AI SDK Compatible
 * POST /api/chat/sessions/:id/messages-v2 - 发送消息（Vercel AI SDK 流式响应）
 */

import { NextRequest } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { db } from '@/lib/db/schema'
import { ragRetrieve } from '@/lib/rag/retrieval'
import { estimateTokens } from '@/lib/semchunk'
import type { Citation } from '@/lib/types/chat'

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

const REFLECTION_THRESHOLD = 0.3
const REFLECTION_LOOPS = 2
const MAX_CONTEXT_TOKENS = 128000
const TOPK_CHILD = 8

const ANSWER_SYSTEM_PROMPT_TEMPLATE = `# Role
你是一个基于"语境尖定与证据填充"策略的专家级知识问答引擎。你的任务是根据提供的【全局摘要】和带有ID标记的【检索片段】，回答用户的提问。

# 🚨 CRITICAL RULE: Citation Format (最高优先级规则)
**这是最重要的规则，你必须严格遵守：**

1. **强制引用**: 当你引用任何【检索片段】中的信息时，**必须立即**在句尾添加引用标记
2. **引用格式**: 使用双方括号格式 \`[[ID]]\`，例如 \`[[1]]\`、\`[[2]]\`
3. **引用位置**: 引用标记必须紧跟在句号、逗号或分号之后
4. **多个引用**: 如果一句话引用多个片段，使用 \`[[1]][[2]]\` 格式
5. **引用密度**: 平均每 1-2 句话就应该有一个引用标记
6. **禁止伪造**: 绝对禁止使用不存在的 ID

# Inputs
## User Query
{{user_query}}

## Global Document Summary (Context)
{{global_summary}}

## Retrieved Context Chunks (Evidence)
{{retrieved_chunks}}

# Constraints
1. **真实性**：回答必须严格基于提供的输入。
2. **引用格式**：严格使用 \`[[ID]]\` 格式。
3. **引用密度**：平均每 1-2 句话就应该有一个引用标记。
4. **流畅性**：像一位人类专家那样写作，将观点和证据融合在连贯的段落中。
`

function buildAnswerSystemPrompt(userQuery: string, globalSummary: string, retrievedChunks: string) {
  return ANSWER_SYSTEM_PROMPT_TEMPLATE
    .split('{{user_query}}').join(userQuery)
    .split('{{global_summary}}').join(globalSummary)
    .split('{{retrieved_chunks}}').join(retrievedChunks)
}

function getTopScore(context: { document: any; documents?: any[]; parents: any[]; children: any[] }) {
  const scores: number[] = []
  if (context.documents && context.documents.length > 0) {
    context.documents.forEach((d) => d?.score && scores.push(d.score))
  } else if (context.document?.score) {
    scores.push(context.document.score)
  }
  context.parents.forEach((p) => scores.push(p.score))
  context.children.forEach((c) => scores.push(c.score))
  return scores.length ? Math.max(...scores) : 0
}

async function rewriteQuery(query: string, openai: ReturnType<typeof createOpenAI>) {
  const systemPrompt = `你是一个搜索查询优化专家。将用户的问题重写为更适合向量检索的查询。只输出优化后的查询，不要解释。`

  try {
    const result = await streamText({
      model: openai.chat('qwen-flash'),
      system: systemPrompt,
      prompt: query,
      maxOutputTokens: 200,
    })

    let rewritten = ''
    for await (const chunk of result.textStream) {
      rewritten += chunk
    }
    return rewritten.trim() || query
  } catch (err) {
    console.warn('[Rewrite] 失败，沿用原查询:', err instanceof Error ? err.message : String(err))
    return query
  }
}

function selectContextChunks(
  context: { document: any; documents?: any[]; parents: any[]; children: any[] }
) {
  const documents = (context.documents && context.documents.length > 0
    ? context.documents
    : context.document
      ? [context.document]
      : [])
    .slice()
    .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
  const parentChunks = context.parents
  const childChunks = [...context.children]
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, TOPK_CHILD)

  return { documents, parentChunks, childChunks }
}

function buildContextStrings(
  context: { document: any; documents?: any[]; parents: any[]; children: any[] }
) {
  const { documents, parentChunks, childChunks } = selectContextChunks(context)

  const buildGlobalSummary = (docs: any[]) => {
    if (docs.length === 0) return '（无）'
    return docs
      .map((doc: any, idx: number) => {
        const docName =
          doc.payload?.metadata?.file_name ||
          (doc.payload?.doc_id ? `doc_${doc.payload.doc_id.slice(0, 8)}` : `doc_${idx + 1}`)
        return `[Doc ${idx + 1}] ${docName}\n${doc.payload?.content || ''}`
      })
      .join('\n\n')
  }

  const buildRetrievedChunks = (parents: any[], children: any[]) => {
    const rows: string[] = []
    let currentId = 1

    for (const chunk of parents) {
      const docName =
        chunk.payload?.metadata?.file_name ||
        (chunk.payload?.doc_id ? `doc_${chunk.payload.doc_id.slice(0, 8)}` : `doc_${currentId}`)
      const content = chunk.payload?.content || ''
      rows.push(`[ID: ${currentId}] Content: (doc: ${docName}, layer: parent) ${content}`)
      currentId += 1
    }

    for (const chunk of children) {
      const docName =
        chunk.payload?.metadata?.file_name ||
        (chunk.payload?.doc_id ? `doc_${chunk.payload.doc_id.slice(0, 8)}` : `doc_${currentId}`)
      const content = chunk.payload?.content || ''
      rows.push(`[ID: ${currentId}] Content: (doc: ${docName}, layer: child) ${content}`)
      currentId += 1
    }

    return rows.length > 0 ? rows.join('\n') : '（无）'
  }

  return {
    globalSummary: buildGlobalSummary(documents),
    retrievedChunks: buildRetrievedChunks(parentChunks, childChunks)
  }
}

function buildAnswerCitations(
  context: { document: any; documents?: any[]; parents: any[]; children: any[] }
): Citation[] {
  const { parentChunks, childChunks } = selectContextChunks(context)

  const citations: Citation[] = []
  let currentId = 1

  for (const parent of parentChunks) {
    const docId = parent.payload?.doc_id || ''
    const docName =
      parent.payload?.metadata?.file_name ||
      (docId ? `doc_${docId.slice(0, 8)}` : `doc_${currentId}`)
    const chunkIndex = parent.payload?.chunk_index

    citations.push({
      index: currentId,
      content: parent.payload?.content || '',
      docId,
      docName,
      chunkIndex: typeof chunkIndex === 'number' ? chunkIndex : undefined,
      score: typeof parent.score === 'number' ? parent.score : undefined,
      layer: 'parent',
    })
    currentId += 1
  }

  for (const child of childChunks) {
    const docId = child.payload?.doc_id || ''
    const docName =
      child.payload?.metadata?.file_name ||
      (docId ? `doc_${docId.slice(0, 8)}` : `doc_${currentId}`)
    const chunkIndex = child.payload?.chunk_index

    citations.push({
      index: currentId,
      content: child.payload?.content || '',
      docId,
      docName,
      chunkIndex: typeof chunkIndex === 'number' ? chunkIndex : undefined,
      score: typeof child.score === 'number' ? child.score : undefined,
      layer: 'child',
    })
    currentId += 1
  }

  return citations
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await context.params
  console.log('[Chat V2 POST] Request received for session:', sessionId)

  try {
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

    // Check session exists
    const session: any = db
      .prepare(
        `SELECT id, kb_id as kbId, user_id as userId, title
        FROM chat_sessions
        WHERE id = ?`
      )
      .get(sessionId)

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

    // Create OpenAI-compatible client via LiteLLM
    const openai = createOpenAI({
      baseURL: process.env.LITELLM_BASE_URL ? `${process.env.LITELLM_BASE_URL.replace(/\/+$/, '')}/v1` : 'http://localhost:4000/v1',
      apiKey: process.env.LITELLM_API_KEY || 'local-dev',
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

          let currentQuery = userMessage
          let ragResult = null

          for (let i = 0; i <= REFLECTION_LOOPS; i++) {
            const result = await ragRetrieve(session.userId, currentQuery, {
              kbId: session.kbId,
              documentIds: sourceIds,
              scoreThreshold: REFLECTION_THRESHOLD,
              documentLimit: 6,
              documentTopK: 3,
              parentLimit: 8,
              childLimit: 8,
              childLimitFromDocs: 8,
              childLimitGlobal: 8,
              childTopK: 8,
              rerank: true,
              enableDocRouting: false,
            })
            const topScore = getTopScore(result.context)
            ragResult = result
            if (topScore < REFLECTION_THRESHOLD && i < REFLECTION_LOOPS) {
              currentQuery = await rewriteQuery(currentQuery, openai)
              continue
            }
            break
          }

          if (ragResult) {
            const { globalSummary, retrievedChunks } = buildContextStrings(ragResult.context)
            finalSystemPrompt = buildAnswerSystemPrompt(userMessage, globalSummary, retrievedChunks)
            citations = buildAnswerCitations(ragResult.context)

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
