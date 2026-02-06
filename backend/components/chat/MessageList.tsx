'use client'

/**
 * MessageList - 消息列表组件
 */

import { MessageBubble } from '@/components/chat/Message'
import { Loader2 } from 'lucide-react'
import type { ChatMessage, Citation } from '@/lib/types/chat'
import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: ChatMessage[]
  streamContent?: string
  streamCitations?: Citation[]
  isLoading?: boolean
  className?: string
}

export function MessageList({
  messages,
  streamContent = '',
  streamCitations = [],
  isLoading = false,
  className,
}: MessageListProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className={cn('text-center text-muted-foreground py-8', className)}>
        <p className="text-lg mb-2">开始新对话</p>
        <p className="text-sm">输入消息开始与 AI 对话</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={{
            role: msg.role,
            content: msg.content,
            citations: msg.citations?.map((c) => ({
              index: c.index,
              content: c.content,
              source: {
                docId: c.docId,
                docName: c.docName,
                chunkIndex: c.chunkIndex,
                score: c.score,
              },
              score: c.score,
            })),
          }}
        />
      ))}

      {/* 实时流式响应 */}
      {isLoading && streamContent && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
            <p className="whitespace-pre-wrap">{streamContent}</p>
            {streamCitations.map((cit, i) => (
              <span
                key={i}
                className="ml-1 text-blue-600 cursor-pointer"
                suppressHydrationWarning
              >
                {String.fromCharCode(0x2460 + cit.index)}
              </span>
            ))}
            <Loader2 className="h-4 w-4 inline ml-2 animate-spin" />
          </div>
        </div>
      )}

      {isLoading && !streamContent && (
        <div className="flex justify-start">
          <div className="rounded-lg px-4 py-2 bg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}
    </div>
  )
}
