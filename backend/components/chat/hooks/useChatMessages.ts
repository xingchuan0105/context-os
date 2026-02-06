/**
 * useChatMessages - 消息获取与缓存
 * 使用 Zustand store 作为唯一状态源
 */

import { useEffect, useState, useCallback } from 'react'
import type { ChatMessage } from '@/lib/types/chat'
import { useChatStore } from '@/lib/stores/chat-store'

interface UseChatMessagesOptions {
  sessionId: string
}

interface UseChatMessagesReturn {
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useChatMessages({
  sessionId,
}: UseChatMessagesOptions): UseChatMessagesReturn {
  // 使用 Zustand store 作为唯一状态源
  const { messages, setMessages } = useChatStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      // 没有 sessionId 时清空消息
      setMessages([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`)
      const data = await res.json()

      if (data.messages) {
        // 调试日志
        console.log('[useChatMessages] Fetched messages:', {
          count: data.messages.length,
          lastMessage: data.messages[data.messages.length - 1],
          hasCitations: data.messages.some((m: ChatMessage) => m.citations && m.citations.length > 0),
        })
        setMessages(data.messages)
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
      setError('Failed to load messages')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, setMessages])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  return {
    messages,
    setMessages,
    isLoading,
    error,
    refetch: fetchMessages,
  }
}
