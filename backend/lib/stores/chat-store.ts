/**
 * Chat Store - 对话状态管理
 */

import { create } from 'zustand'
import { ChatSession, ChatMessage, Citation } from '@/lib/types/chat'

interface ChatStore {
  // 当前会话
  currentSession: ChatSession | null
  messages: ChatMessage[]

  // 会话列表
  sessions: ChatSession[]

  // 加载状态
  isLoading: boolean
  isStreaming: boolean
  error: string | null

  // 操作
  setSessions: (sessions: ChatSession[]) => void
  setCurrentSession: (session: ChatSession | null) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  updateLastMessage: (content: string, citations?: Citation[]) => void

  setLoading: (loading: boolean) => void
  setStreaming: (streaming: boolean) => void
  setError: (error: string | null) => void

  // 清理
  clear: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // 初始状态
  currentSession: null,
  messages: [],
  sessions: [],
  isLoading: false,
  isStreaming: false,
  error: null,

  // 设置会话列表
  setSessions: (sessions) => set({ sessions }),

  // 设置当前会话
  setCurrentSession: (session) => set({ currentSession: session, messages: [] }),

  // 设置消息列表
  setMessages: (messages) => set({ messages }),

  // 添加消息
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  // 更新最后一条消息（用于流式响应）
  updateLastMessage: (content, citations) =>
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1
      if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content,
          citations: citations || messages[lastIndex].citations,
        }
      }
      return { messages }
    }),

  // 设置加载状态
  setLoading: (isLoading) => set({ isLoading }),

  // 设置流式状态
  setStreaming: (isStreaming) => set({ isStreaming }),

  // 设置错误
  setError: (error) => set({ error }),

  // 清理状态
  clear: () =>
    set({
      currentSession: null,
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
    }),
}))

// ==================== Selectors ====================

/**
 * Selector hooks for optimized re-rendering
 */

/** Get all sessions */
export const useSessions = () => useChatStore((state) => state.sessions)

/** Get current session */
export const useCurrentSession = () => useChatStore((state) => state.currentSession)

/** Get messages */
export const useMessages = () => useChatStore((state) => state.messages)

/** Get loading states */
export const useChatLoading = () => useChatStore((state) => state.isLoading)
export const useChatStreaming = () => useChatStore((state) => state.isStreaming)

/** Get error */
export const useChatError = () => useChatStore((state) => state.error)

/** Get chat actions */
export const useChatActions = () => useChatStore((state) => ({
  setSessions: state.setSessions,
  setCurrentSession: state.setCurrentSession,
  setMessages: state.setMessages,
  addMessage: state.addMessage,
  updateLastMessage: state.updateLastMessage,
  setLoading: state.setLoading,
  setStreaming: state.setStreaming,
  setError: state.setError,
  clear: state.clear,
}))

