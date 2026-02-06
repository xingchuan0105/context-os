/**
 * 流式 Chat API
 * 使用 SSE 返回流式响应
 */

import { NextRequest } from 'next/server'
import { createSSEStreamWithSender, getSSEHeaders } from '@/lib/sse/stream-builder'
import { createLLMClient } from '@/lib/llm-client'
import type OpenAI from 'openai'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

interface StreamRequest {
  message: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  mockCitations?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const { message, model = 'siliconflow_deepseek', temperature, maxTokens, systemPrompt, mockCitations = false }: StreamRequest =
      await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      createSSEStreamWithSender(async (sender) => {
        try {
        // 发送开始事件
        sender.start({ model, timestamp: Date.now() })

        // 构建 messages
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt })
        }

        messages.push({ role: 'user', content: message })

        // 创建 LLM 客户端
        const client = createLLMClient(model)

        // 流式调用
        await client.chatStream(messages, {
          temperature,
          maxTokens,
          onEvent: (event) => {
            if (event.type === 'delta' && event.content && event.content !== '[FIRST_TOKEN]') {
              sender.token(event.content)
            } else if (event.type === 'error') {
              sender.error(event.error)
            }
          },
        })

        // 模拟引用（如果启用）
        if (mockCitations) {
          sender.citation(1, 'Context OS 是一个基于 RAG 的知识管理工具...', {
            docId: 'doc-1',
            docName: 'Context OS PRD.md',
            chunkIndex: 0,
            score: 0.92,
          })
        }

        sender.done({ timestamp: Date.now() })
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
