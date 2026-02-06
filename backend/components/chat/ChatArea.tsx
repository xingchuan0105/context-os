'use client'

/**
 * ChatArea - 对话主区域（重构版）
 *
 * 拆分为多个自定义 hooks 和子组件，提升可维护性和可测试性
 */

import { useState, useCallback, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageList } from '@/components/chat/MessageList'
import { ChatInput } from '@/components/chat/ChatInput'
import { useChatStore } from '@/lib/stores/chat-store'
import { useDocumentSourceStore } from '@/lib/stores/document-source-store'
import { useChatMessages } from './hooks/useChatMessages'
import { useChatStreaming } from './hooks/useChatStreaming'
import { useChatScroll } from './hooks/useChatScroll'
import { cn } from '@/lib/utils'

interface ChatAreaProps {
  sessionId: string
  kbId: string
  className?: string
}

export function ChatArea({ sessionId, kbId, className }: ChatAreaProps) {
  // Stores
  const { addMessage, setStreaming, setError: setChatError, error: chatError } =
    useChatStore()
  const { getSelectedIds, selectedSourceIds } = useDocumentSourceStore()
  const hasSelectedSources = selectedSourceIds.size > 0

  // Hooks
  const { messages, refetch } = useChatMessages({ sessionId })
  const { streamContent, streamCitations, isLoading, startStream, abortStream } =
    useChatStreaming({
      sessionId,
      onStreamComplete: () => {
        refetch()
        setStreaming(false)
      },
      onError: (message) => {
        setChatError(message)
        setStreaming(false)
      },
    })
  const scrollRef = useChatScroll({
    messages,
    streamContent,
  })

  // Local state
  const [input, setInput] = useState('')
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null)

  // Cleanup on unmount
  useEffect(
    () => () => {
      abortStream()
    },
    [abortStream]
  )

  // Send message handler
  const handleSend = useCallback(async () => {
    const messageContent = input.trim()
    if (!messageContent || isLoading) return

    const selectedIds = getSelectedIds()
    if (selectedIds.length === 0) {
      setChatError('请先选择文档来源后再提问')
      return
    }

    setChatError(null)
    setLastUserMessage(messageContent)
    setInput('')
    setStreaming(true)

    // Add user message
    addMessage({
      id: Date.now(),
      sessionId,
      role: 'user',
      content: messageContent,
      createdAt: new Date().toISOString(),
    })

    // Add AI message placeholder
    addMessage({
      id: Date.now() + 1,
      sessionId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    })

    // Start streaming
    await startStream(messageContent, selectedIds)
  }, [input, isLoading, getSelectedIds, sessionId, addMessage, setChatError, setStreaming, startStream])

  // Retry handler
  const handleRetry = useCallback(() => {
    if (!lastUserMessage || isLoading) return
    handleSend()
  }, [lastUserMessage, isLoading, handleSend])

  return (
    <div className={cn('flex flex-col', className)}>
      {/* 消息列表 */}
      <ScrollArea className="flex-1 p-4">
        <div ref={scrollRef} className="space-y-4">
          <MessageList
            messages={messages}
            streamContent={streamContent}
            streamCitations={streamCitations}
            isLoading={isLoading}
          />
        </div>
      </ScrollArea>

      {/* 输入区 */}
      <div className="border-t p-4">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onAbort={abortStream}
          isLoading={isLoading}
          disabled={!hasSelectedSources}
          error={chatError}
          placeholder={
            hasSelectedSources
              ? '输入消息... (Enter 发送, Shift+Enter 换行)'
              : '请先选择文档后再提问'
          }
          showWarning={!hasSelectedSources}
          warningMessage="请先在左侧选择已完成处理的文档"
        />
      </div>
    </div>
  )
}
