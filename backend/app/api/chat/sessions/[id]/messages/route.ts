/**
 * Chat Messages API
 * POST /api/chat/sessions/:id/messages - 发送消息（流式响应）
 */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db/schema'
import { createSSEStreamWithSender, getSSEHeaders } from '@/lib/sse/stream-builder'
import { createLLMClient } from '@/lib/llm-client'
import { ragRetrieve } from '@/lib/rag/retrieval'
import { estimateTokens } from '@/lib/semchunk'
import type { Citation } from '@/lib/types/chat'
import type OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SendMessageRequest {
  message: string
  selectedSourceIds?: string[]
  model?: string
  systemPrompt?: string
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

**正确示例**:
- "LightRAG 是一个轻量级的 RAG 框架[[1]]。"
- "该框架采用双级检索策略[[2]][[3]]。"
- "实验结果显示，LightRAG 在多个数据集上表现优异[[5]]。"

**错误示例**:
- ❌ "LightRAG 是一个轻量级的 RAG 框架。" (缺少引用)
- ❌ "根据文档1，LightRAG..." (不要用文字描述，直接用 [[1]])
- ❌ "LightRAG[[1]] 是一个框架。" (引用应该在句尾)

# Strategy: Scaffolding & Filling (Internal Logic)
请在内心遵循以下思维路径，但在输出时不要暴露这些步骤的标题：

1. **宏观定调 (Scaffolding):**
   - 利用【全局摘要】确定回答的背景和核心观点。这是回答的"骨架"。
   - 回答的开头应自然地建立语境，而不是生硬地复述摘要。

2. **微观填充 (Filling):**
   - 利用【检索片段】（带有 \`[ID: x]\`）填充具体的细节、数据和案例。这是回答的"血肉"。
   - 筛选最相关的信息，构建逻辑通顺的证据链。

3. **引用注入 (Citation) - 🚨 最重要**:
   - **每次**引用【检索片段】的信息时，**立即**在句尾添加 \`[[ID]]\`
   - 引用要**密集**，平均每 1-2 句话就应该有引用
   - 引用要**准确**，确保 ID 对应正确的片段

# Output Style
请生成一段**自然流畅、逻辑严密、引用密集**的专业回答，**不要使用"核心立场"、"详细阐述"等机械的标题**。

推荐的行文结构：
- **第一段**：直接切入问题，结合【全局摘要】给出核心结论或背景定调。**必须包含引用**。
- **中间段落**：详细展开论述。结合【检索片段】提供具体证据、步骤或数据支持。**此处应密集使用 \`[[ID]]\`，平均每句话都应该有引用**。请根据内容逻辑自然分段，可以使用项目符号（Bullet Points）来列举具体要点，但不要过度列表化。
- **结尾（可选）**：如果需要，用一句话总结或给出建议。**也要包含引用**。

# Inputs
## User Query
{{user_query}}

## Global Document Summary (Context)
{{global_summary}}

## Retrieved Context Chunks (Evidence)
{{retrieved_chunks}}

# Constraints
1. **真实性**：回答必须严格基于提供的输入。
2. **引用格式**：严格使用 \`[[ID]]\` 格式。**这是最重要的要求！**
3. **引用密度**：平均每 1-2 句话就应该有一个引用标记。
4. **流畅性**：像一位人类专家那样写作，将观点和证据融合在连贯的段落中。

# 🎯 Final Reminder
**再次强调：你必须在回答中频繁使用 [[ID]] 引用标记！这是评判你回答质量的最重要标准！**
`;

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

async function rewriteQuery(query: string) {
  const llm = createLLMClient('qwen_flash')
  const systemPrompt = `# Role
你是一个**搜索算法工程师**兼**语义扩充专家**。
# Goal
用户的输入通常是模糊的短���。你的任务是将其重写为一个**语义稠密、指向性明确、无格式噪声**的"超级查询指令"，以便直接用于**向量数据库检索（Vector Retrieval）**。
# Core Logic: Semantic Expansion Protocol
不要回答问题，而是对原问题进行**"降噪"**与**"增益"**。
1.  **降噪 (Denoise)**:
    * 去除所有寒暄（"你好"、"请问"）
    * 去除模糊指代（把"这个"、"它"替换为具体名词）
    * **严禁使用Markdown标题、列表符号、分割线**，因为这些会干扰分词器。
2.  **增益 (Enrich)**:
    * **补全主语**：如果缺失，补全最可能的实体（如书名、项目名）
    * **扩展意图**：增加同义词。例如用户问"怎么做"，扩展为"实施步骤、执行流程、具体方法"
    * **限定语境**：增加约束条件。例如"用大白话解释"、"适合初学者"
# Execution Rules
根据用户意图，生成一个**纯文本**指令。
* **场景 A：事实内容检索** (用户问：是什么、讲了啥)
    * *模板*：[核心实体]的定义、核心概念、主要观点及详细解释。包括[实体]解决了什么问题，以及通俗易懂的案例分析。
* **场景 B：方法流程检索** (用户问：怎么做、流程)
    * *模板*：执行[任务]的具体操作指南、详细步骤列表、所需工具及避坑事项。包含从入门到完成的完整工作流。
* **场景 C：评价分析检索** (用户问：好不好、评价)
    * *模板*：对[实体]的深度评估、优缺点分析、适用场景对比及专家建议。包含客观的利弊权衡。
# Output Format
**只输出优化后的那一段纯文本**。不要包含"优化后的指令："等前缀，不要换行，不要解释，不要使用任何Markdown格式。`
  const userPrompt = `# User Input
${query}`
  try {
    const { content } = await llm.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0 },
    )
    const rewritten = sanitizeRewriteOutput(content)
    if (rewritten) return rewritten
  } catch (err) {
    console.warn('[Rewrite] 失败，沿用原查询:', err instanceof Error ? err.message : String(err))
  }
  return query
}

function sanitizeRewriteOutput(raw: string): string {
  if (!raw) return ''
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '---')
    .map((line) => line.replace(/^[#>*-]+\s*/g, ''))
    .map((line) => line.replace(/^(优化后的指令|改写后的查询|重写后的查询|输出|指令)[:：]\s*/i, ''))
  return lines.join(' ').replace(/\s+/g, ' ').trim()
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

function buildDeepSeekMessages(
  query: string,
  context: { document: any; documents?: any[]; parents: any[]; children: any[] },
  systemPrompt?: string,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const { documents, parentChunks, childChunks } = selectContextChunks(context)

  const buildGlobalSummary = (docs: any[]) => {
    if (docs.length === 0) return '\uFF08\u65E0\uFF09'
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

    // 先添加父块（章节上下文）
    for (const chunk of parents) {
      const docName =
        chunk.payload?.metadata?.file_name ||
        (chunk.payload?.doc_id ? `doc_${chunk.payload.doc_id.slice(0, 8)}` : `doc_${currentId}`)
      const content = chunk.payload?.content || ''
      rows.push(`[ID: ${currentId}] Content: (doc: ${docName}, layer: parent) ${content}`)
      currentId += 1
    }

    // 再添加子块（具体细节）
    for (const chunk of children) {
      const docName =
        chunk.payload?.metadata?.file_name ||
        (chunk.payload?.doc_id ? `doc_${chunk.payload.doc_id.slice(0, 8)}` : `doc_${currentId}`)
      const content = chunk.payload?.content || ''
      rows.push(`[ID: ${currentId}] Content: (doc: ${docName}, layer: child) ${content}`)
      currentId += 1
    }

    return rows.length > 0 ? rows.join('\n') : '\uFF08\u65E0\uFF09'
  }

  const retrievedChunks = buildRetrievedChunks(parentChunks, childChunks)
  const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  if (systemPrompt) baseMessages.push({ role: 'system', content: systemPrompt })

  const baseTokenCount = baseMessages.reduce(
    (total, msg) => total + estimateTokens(String(msg.content || '')),
    0,
  )

  let docPool = documents.slice()
  let systemMessage = buildAnswerSystemPrompt(
    query,
    buildGlobalSummary(docPool),
    retrievedChunks
  )
  const userContent = query
  let totalTokens = baseTokenCount + estimateTokens(systemMessage) + estimateTokens(userContent)

  while (docPool.length > 0 && totalTokens > MAX_CONTEXT_TOKENS) {
    docPool.pop()
    systemMessage = buildAnswerSystemPrompt(
      query,
      buildGlobalSummary(docPool),
      retrievedChunks
    )
    totalTokens = baseTokenCount + estimateTokens(systemMessage) + estimateTokens(userContent)
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...baseMessages,
  ]
  messages.push({ role: 'system', content: systemMessage })
  messages.push({ role: 'user', content: userContent })
  return messages
}

function buildAnswerCitations(
  context: { document: any; documents?: any[]; parents: any[]; children: any[] },
): Citation[] {
  const { parentChunks, childChunks } = selectContextChunks(context)

  const citations: Citation[] = []
  let currentId = 1

  // 先添加父块引用（与 buildRetrievedChunks 顺序一致）
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

  // 再添加子块引用
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

    // 检查会话是否存在
    const session: any = db
      .prepare(
        `
        SELECT id, kb_id as kbId, user_id as userId, title
        FROM chat_sessions
        WHERE id = ?
      `
      )
      .get(sessionId)

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
          const client = createLLMClient(modelKey)
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

        let currentQuery = message
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
            currentQuery = await rewriteQuery(currentQuery)
            continue
          }
          break
        }

        if (!ragResult) {
          throw new Error('RAG 检索失败')
        }

        console.log('[Chat RAG] RAG result:', {
          totalResults: ragResult.totalResults,
          documentsCount: ragResult.context.documents?.length || (ragResult.context.document ? 1 : 0),
          parentsCount: ragResult.context.parents.length,
          childrenCount: ragResult.context.children.length,
          firstDocContent: ragResult.context.documents?.[0]?.payload?.content?.slice(0, 100) || ragResult.context.document?.payload?.content?.slice(0, 100) || 'N/A',
          firstParentContent: ragResult.context.parents[0]?.payload?.content?.slice(0, 100) || 'N/A',
          firstChildContent: ragResult.context.children[0]?.payload?.content?.slice(0, 100) || 'N/A',
        })

        const docCount = ragResult.context.documents && ragResult.context.documents.length > 0 ? ragResult.context.documents.length : ragResult.context.document ? 1 : 0
        sender.send({
          type: 'search',
          data: {
            count: ragResult.totalResults,
            breakdown: {
              document: docCount,
              parents: ragResult.context.parents.length,
              children: ragResult.context.children.length,
            },
            documentIds: sourceIds,
          },
        })

        citations.push(...buildAnswerCitations(ragResult.context))

        // ========== DeepSeek 生成回答 ==========
        const client = createLLMClient(modelKey)
        const finalMessages = buildDeepSeekMessages(currentQuery, ragResult.context, systemPrompt)

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
