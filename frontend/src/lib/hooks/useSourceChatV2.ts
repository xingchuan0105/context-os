'use client'

import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sourceChatApi } from '@/lib/api/source-chat'
import {
  SourceChatSession,
  SourceChatMessage,
  SourceChatContextIndicator,
  CreateSourceChatSessionRequest,
  UpdateSourceChatSessionRequest,
  ChatCitation
} from '@/lib/types/api'
import { getAuthToken } from '@/lib/auth/token-utils'
import { getApiUrl } from '@/lib/config'
import { useTypewriterMessages } from '@/lib/hooks/use-typewriter-messages'

/**
 * Convert Vercel AI SDK Message to our SourceChatMessage format
 */
function getMessageText(message: UIMessage): string {
  const parts = (message as { parts?: Array<{ type: string; text?: string }> }).parts
  if (Array.isArray(parts)) {
    const text = parts
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
    if (text) return text
  }
  const fallback = (message as { content?: string }).content
  return typeof fallback === 'string' ? fallback : ''
}

function convertToSourceChatMessage(msg: UIMessage, citationsMap: Map<string, ChatCitation[]>): SourceChatMessage {
  return {
    id: msg.id,
    type: msg.role === 'user' ? 'human' : 'ai',
    content: getMessageText(msg),
    timestamp: (msg as { createdAt?: Date }).createdAt?.toISOString(),
    citations: citationsMap.get(msg.id)
  }
}

/**
 * Convert our SourceChatMessage to Vercel AI SDK Message format
 */
function convertToAIMessage(msg: SourceChatMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.type === 'human' ? 'user' : 'assistant',
    parts: [{ type: 'text', text: msg.content }],
  }
}

export function useSourceChatV2(sourceId: string, locale?: string) {
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [contextIndicators, setContextIndicators] = useState<SourceChatContextIndicator | null>(null)
  const [citationsMap, setCitationsMap] = useState<Map<string, ChatCitation[]>>(new Map())
  const [typewriterBaselineId, setTypewriterBaselineId] = useState<string | null>(null)
  const [typewriterEnabled, setTypewriterEnabled] = useState(false)
  const aiMessagesRef = useRef<UIMessage[]>([])
  const citationsMapRef = useRef<Map<string, ChatCitation[]>>(new Map())
  const pendingCitationsRef = useRef<ChatCitation[] | null>(null)
  const [pendingMessage, setPendingMessage] = useState<{
    message: string
    modelOverride?: string
    sessionId: string
  } | null>(null)

  // Fetch sessions
  const { data: sessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useQuery<SourceChatSession[]>({
    queryKey: ['sourceChatSessions', sourceId],
    queryFn: () => sourceChatApi.listSessions(sourceId),
    enabled: !!sourceId
  })

  // Fetch current session with messages (for initial load)
  const { data: currentSession } = useQuery({
    queryKey: ['sourceChatSession', sourceId, currentSessionId],
    queryFn: () => sourceChatApi.getSession(sourceId, currentSessionId!),
    enabled: !!sourceId && !!currentSessionId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity
  })

  // Convert initial messages from server to AI SDK format
  const initialMessages = useMemo(() => {
    if (!currentSession?.messages) return []
    // Also populate citations map from initial messages
    const newCitationsMap = new Map<string, ChatCitation[]>()
    currentSession.messages.forEach(msg => {
      if (msg.citations) {
        newCitationsMap.set(msg.id, msg.citations)
      }
    })
    setCitationsMap(newCitationsMap)
    return currentSession.messages.map(convertToAIMessage)
  }, [currentSession?.messages])

  // Build system prompt based on locale
  const systemPrompt = useMemo(() => {
    if (!locale) return undefined
    return locale === 'zh'
      ? 'Please respond in Chinese unless the user explicitly asks for another language.'
      : 'Please respond in English unless the user explicitly asks for another language.'
  }, [locale])

  // Use Vercel AI SDK's useChat hook
  const transport = useMemo(() => {
    const api = currentSessionId
      ? `/api/chat/sessions/${currentSessionId}/messages-v2`
      : '/api/chat/sessions/pending/messages-v2'
    return new DefaultChatTransport({
      api,
      fetch: async (input, init) => {
        let resolvedInput: RequestInfo | URL = input
        try {
          if (typeof input === 'string') {
            if (input.startsWith('/')) {
              const baseUrl = await getApiUrl()
              resolvedInput = `${baseUrl}${input}`
            }
          } else if (typeof window !== 'undefined') {
            const inputUrl = input instanceof Request ? input.url : String(input)
            if (inputUrl.startsWith(window.location.origin)) {
              const url = new URL(inputUrl)
              if (url.pathname.startsWith('/api/')) {
                const baseUrl = await getApiUrl()
                resolvedInput = `${baseUrl}${url.pathname}${url.search}`
              }
            }
          }
        } catch (error) {
          console.warn('[useSourceChatV2] Failed to resolve API URL:', error)
        }

        const response = await fetch(resolvedInput, init)
        if (response.ok) {
          return response
        }
        let message = `HTTP error: ${response.status}`
        try {
          const data = await response.json()
          if (data?.error) {
            message = String(data.error)
          }
        } catch (error) {
          try {
            const text = await response.text()
            if (text) {
              message = text
            }
          } catch {}
        }
        throw new Error(response.status === 404 ? 'Session not found' : message)
      },
      prepareSendMessagesRequest: ({ messages, body }) => {
        const normalizedMessages = messages
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
          .map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: getMessageText(msg),
          }))
        return {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
          body: {
            sourceId,
            systemPrompt,
            ...(body ?? {}),
            messages: normalizedMessages,
          },
        }
      },
    })
  }, [currentSessionId, sourceId, systemPrompt])

  const {
    messages: aiMessages,
    status,
    sendMessage: sendChatMessage,
    setMessages,
    stop
  } = useChat({
    id: currentSessionId || undefined,
    messages: initialMessages,
    transport,
    onFinish: ({ message }) => {
      console.log('[useSourceChatV2] Message finished:', message.id)
      // Refetch sessions to update the list
      refetchSessions()
    },
    onData: (dataPart) => {
      const part = dataPart as {
        type?: string
        data?: { citations?: ChatCitation[] }
        citations?: ChatCitation[]
      } | null

      const citations =
        part?.type === 'data-citations'
          ? part.data?.citations
          : part?.citations

      if (!citations || citations.length === 0) {
        return
      }
      pendingCitationsRef.current = citations
      const candidate = [...aiMessagesRef.current]
        .reverse()
        .find(m => m.role === 'assistant' && !citationsMapRef.current.has(m.id))
      if (candidate) {
        setCitationsMap(prev => {
          const newMap = new Map(prev)
          newMap.set(candidate.id, citations)
          return newMap
        })
        pendingCitationsRef.current = null
      }
    },
    onError: (error: Error) => {
      console.error('[useSourceChatV2] Error:', error)
      toast.error('Failed to send message')
    },
  })

  const isStreaming = status === 'submitted' || status === 'streaming'
  const displayAiMessages = useTypewriterMessages(
    aiMessages,
    typewriterEnabled,
    undefined,
    typewriterBaselineId
  )

  useEffect(() => {
    citationsMapRef.current = citationsMap
  }, [citationsMap])

  useEffect(() => {
    aiMessagesRef.current = aiMessages
    if (!pendingCitationsRef.current) return
    const candidate = [...aiMessages]
      .reverse()
      .find(m => m.role === 'assistant' && !citationsMapRef.current.has(m.id))
    if (!candidate) return
    setCitationsMap(prev => {
      const newMap = new Map(prev)
      newMap.set(candidate.id, pendingCitationsRef.current as ChatCitation[])
      return newMap
    })
    pendingCitationsRef.current = null
  }, [aiMessages])

  // Convert AI SDK messages to our format
  const messages: SourceChatMessage[] = useMemo(() => {
    return displayAiMessages.map(msg => convertToSourceChatMessage(msg, citationsMap))
  }, [displayAiMessages, citationsMap])

  // Auto-select most recent session when sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      const mostRecentSession = sessions[0]
      setCurrentSessionId(mostRecentSession.id)
    }
  }, [sessions, currentSessionId])

  // Sync messages when session changes
  useEffect(() => {
    if (currentSession?.messages && currentSessionId) {
      const convertedMessages = currentSession.messages.map(convertToAIMessage)
      setMessages(convertedMessages)
      // Also sync citations
      const newCitationsMap = new Map<string, ChatCitation[]>()
      currentSession.messages.forEach(msg => {
        if (msg.citations) {
          newCitationsMap.set(msg.id, msg.citations)
        }
      })
      setCitationsMap(newCitationsMap)
    }
  }, [currentSession, currentSessionId, setMessages])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: Omit<CreateSourceChatSessionRequest, 'source_id'>) =>
      sourceChatApi.createSession(sourceId, data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
      setCurrentSessionId(newSession.id)
      setMessages([])
      setCitationsMap(new Map())
      toast.success('Chat session created')
    },
    onError: () => {
      toast.error('Failed to create chat session')
    }
  })

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string, data: UpdateSourceChatSessionRequest }) =>
      sourceChatApi.updateSession(sourceId, sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
      queryClient.invalidateQueries({ queryKey: ['sourceChatSession', sourceId, currentSessionId] })
      toast.success('Session updated')
    },
    onError: () => {
      toast.error('Failed to update session')
    }
  })

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      sourceChatApi.deleteSession(sourceId, sessionId),
    onSuccess: (_, deletedId) => {
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null)
        setMessages([])
        setCitationsMap(new Map())
      }
      queryClient.removeQueries({ queryKey: ['sourceChatSession', sourceId, deletedId] })
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
      toast.success('Session deleted')
    },
    onError: () => {
      toast.error('Failed to delete session')
    }
  })

  // Send message - auto-create session if needed
  const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
    let sessionId = currentSessionId

    // Auto-create session if none exists
    if (!sessionId) {
      try {
        const defaultTitle = message.length > 30 ? `${message.substring(0, 30)}...` : message
        const newSession = await sourceChatApi.createSession(sourceId, { title: defaultTitle })
        sessionId = newSession.id
        setCurrentSessionId(sessionId)
        queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
        setPendingMessage({
          message,
          modelOverride,
          sessionId,
        })
        return
      } catch (error) {
        console.error('Failed to create chat session:', error)
        toast.error('Failed to create chat session')
        return
      }
    }

    // Send the message
    const lastAssistant = [...aiMessagesRef.current].reverse().find(m => m.role === 'assistant')
    setTypewriterBaselineId(lastAssistant?.id ?? null)
    setTypewriterEnabled(true)
    sendChatMessage({
      text: message
    }, {
      body: {
        model: modelOverride
      }
    })
  }, [sourceId, currentSessionId, sendChatMessage, queryClient])

  useEffect(() => {
    if (pendingMessage && currentSessionId === pendingMessage.sessionId) {
      const timer = setTimeout(() => {
        const lastAssistant = [...aiMessagesRef.current].reverse().find(m => m.role === 'assistant')
        setTypewriterBaselineId(lastAssistant?.id ?? null)
        setTypewriterEnabled(true)
        sendChatMessage({
          text: pendingMessage.message
        }, {
          body: {
            model: pendingMessage.modelOverride
          }
        })
        setPendingMessage(null)
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [currentSessionId, pendingMessage, sendChatMessage])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
    setMessages([])
    setCitationsMap(new Map())
    setContextIndicators(null)
    setTypewriterBaselineId(null)
    setTypewriterEnabled(false)
  }, [setMessages])

  // Create session
  const createSession = useCallback((data: Omit<CreateSourceChatSessionRequest, 'source_id'>) => {
    return createSessionMutation.mutate(data)
  }, [createSessionMutation])

  // Update session
  const updateSession = useCallback((sessionId: string, data: UpdateSourceChatSessionRequest) => {
    return updateSessionMutation.mutate({ sessionId, data })
  }, [updateSessionMutation])

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    return deleteSessionMutation.mutate(sessionId)
  }, [deleteSessionMutation])

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    stop()
  }, [stop])

  return {
    // State
    sessions,
    currentSession: sessions.find(s => s.id === currentSessionId),
    currentSessionId,
    messages,
    isStreaming,
    streamStatus: status,
    contextIndicators,
    loadingSessions,

    // Actions
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    sendMessage,
    cancelStreaming,
    refetchSessions
  }
}
