import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createLLMClient } from '@/lib/llm-client'
import {
  UnauthorizedError,
  ValidationError,
  withErrorHandler,
} from '@/lib/api/errors'
import type OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type QuickNoteMessage = {
  role: 'user' | 'assistant'
  content: string
}

type QuickNoteLabelRequest = {
  messages?: QuickNoteMessage[]
  locale?: 'zh' | 'en'
}

const normalizeMessages = (messages: QuickNoteMessage[]) =>
  messages
    .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant'))
    .map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content.trim() : '',
    }))
    .filter((msg) => msg.content.length > 0)

const buildUserPrompt = (messages: QuickNoteMessage[]) => {
  const lines = messages.map((msg) => {
    const label = msg.role === 'user' ? 'User' : 'AI'
    return `[${label}] ${msg.content}`
  })
  return `Conversation:\n${lines.join('\n')}`
}

const buildSystemPrompt = (locale: 'zh' | 'en') => {
  if (locale === 'zh') {
    return [
      '你是随手记标签生成器。',
      '根据对话内容生成一个简短标签：',
      '- 仅输出标签文本',
      '- 不要引号，不要解释',
      '- 6-12 个中文字符（必要时可略长，但保持简短）',
    ].join('\n')
  }
  return [
    'You are a quick-note label generator.',
    'Generate a concise label from the conversation:',
    '- Output label text only',
    '- No quotes, no explanations',
    '- 3-6 words maximum',
  ].join('\n')
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  let body: QuickNoteLabelRequest
  try {
    body = (await req.json()) as QuickNoteLabelRequest
  } catch {
    throw new ValidationError('Invalid JSON body')
  }

  const locale = body.locale === 'en' ? 'en' : 'zh'
  const messages = normalizeMessages(body.messages || [])
  if (messages.length === 0) {
    throw new ValidationError('messages is required', { field: 'messages' })
  }

  const client = createLLMClient('qwen_flash')
  const llmMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(locale) },
    { role: 'user', content: buildUserPrompt(messages) },
  ]

  const result = await client.chat(llmMessages, {
    temperature: 0.2,
    maxTokens: locale === 'zh' ? 30 : 32,
  })

  const label = result.content.trim().replace(/^["']|["']$/g, '')
  return NextResponse.json({ label })
})
