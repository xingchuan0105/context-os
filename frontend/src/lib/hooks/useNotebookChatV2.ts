'use client'

import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { chatApi } from '@/lib/api/chat'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  NotebookChatSession,
  NotebookChatMessage,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SourceListResponse,
  NoteResponse,
  ChatCitation
} from '@/lib/types/api'
import { ContextSelections } from '@/lib/types/common'
import { getAuthToken } from '@/lib/auth/token-utils'
import { getApiUrl } from '@/lib/config'
import { useTypewriterMessages } from '@/lib/hooks/use-typewriter-messages'

interface UseNotebookChatV2Params {
  notebookId: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
  contextSelections: ContextSelections
  locale?: string
}

/**
 * Convert Vercel AI SDK Message to our NotebookChatMessage format
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

function convertToNotebookChatMessage(msg: UIMessage, citationsMap: Map<string, ChatCitation[]>): NotebookChatMessage {
  return {
    id: msg.id,
    type: msg.role === 'user' ? 'human' : 'ai',
    content: getMessageText(msg),
    timestamp: (msg as { createdAt?: Date }).createdAt?.toISOString(),
    citations: citationsMap.get(msg.id)
  }
}

/**
 * Convert our NotebookChatMessage to Vercel AI SDK Message format
 */
function convertToAIMessage(msg: NotebookChatMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.type === 'human' ? 'user' : 'assistant',
    parts: [{ type: 'text', text: msg.content }],
  }
}

export function useNotebookChatV2({ notebookId, sources, notes, contextSelections, locale }: UseNotebookChatV2Params) {
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [citationsMap, setCitationsMap] = useState<Map<string, ChatCitation[]>>(new Map())
  const [tokenCount, setTokenCount] = useState<number>(0)
  const [charCount, setCharCount] = useState<number>(0)
  const [pendingModelOverride, setPendingModelOverride] = useState<string | null>(null)
  const [lastError, setLastError] = useState<{ type: 'session' | 'network' | 'unknown'; message: string } | null>(null)
  const [streamPhase, setStreamPhase] = useState<'retrieving' | 'generating' | 'saving' | null>(null)
  const [typewriterBaselineId, setTypewriterBaselineId] = useState<string | null>(null)
  const [typewriterEnabled, setTypewriterEnabled] = useState(false)
  const aiMessagesRef = useRef<UIMessage[]>([])
  const citationsMapRef = useRef<Map<string, ChatCitation[]>>(new Map())
  const pendingCitationsRef = useRef<ChatCitation[] | null>(null)
  const lastUserMessageRef = useRef<{ message: string; modelOverride?: string } | null>(null)
  // Pending message to send after session is created (to handle async state update)
  const [pendingMessage, setPendingMessage] = useState<{
    message: string
    modelOverride?: string
    sessionId: string
    notesContext: string
  } | null>(null)

  // Fetch sessions for this notebook
  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch: refetchSessions
  } = useQuery({
    queryKey: QUERY_KEYS.notebookChatSessions(notebookId),
    queryFn: () => chatApi.listSessions(notebookId),
    enabled: !!notebookId
  })

  // Fetch current session with messages (for initial load)
  const { data: currentSession } = useQuery({
    queryKey: QUERY_KEYS.notebookChatSession(currentSessionId!),
    queryFn: () => chatApi.getSession(currentSessionId!),
    enabled: !!notebookId && !!currentSessionId,
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

  // Get selected source IDs
  const selectedSourceIds = useMemo(() => {
    return sources
      .filter((source) => {
        if (contextSelections.sources[source.id] === 'off') {
          return false
        }
        const status = source.status?.toLowerCase()
        if (!status) {
          return true
        }
        return status === 'completed' || status === 'complete' || status === 'done'
      })
      .map((source) => source.id)
  }, [sources, contextSelections.sources])

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
          console.warn('[useNotebookChatV2] Failed to resolve API URL:', error)
        }

        const response = await fetch(resolvedInput, init)
        if (response.ok) {
          setLastError(null)
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
            notebookId,
            selectedSourceIds,
            systemPrompt,
            model: pendingModelOverride || currentSession?.model_override,
            ...(body ?? {}),
            messages: normalizedMessages,
          },
        }
      },
    })
  }, [currentSessionId, notebookId, selectedSourceIds, systemPrompt, pendingModelOverride, currentSession?.model_override])

  const {
    messages: aiMessages,
    status,
    sendMessage: sendChatMessage,
    setMessages,
    stop,
    error: chatError
  } = useChat({
    id: currentSessionId || undefined,
    messages: initialMessages,
    transport,
    onFinish: ({ message }) => {
      console.log('[useNotebookChatV2] Message finished:', message.id)
      setStreamPhase(null)
      // Refetch sessions to update the list
      refetchSessions()
    },
    onData: (dataPart) => {
      const part = dataPart as {
        type?: string
        data?: { status?: string; citations?: ChatCitation[] }
        citations?: ChatCitation[]
        status?: string
      } | null

      const status = part?.type === 'data-status'
        ? part.data?.status
        : part?.status
      if (status === 'retrieving' || status === 'generating' || status === 'saving') {
        setStreamPhase(status)
      }

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
      console.error('[useNotebookChatV2] Error:', error)
      setStreamPhase(null)
      const raw = error.message || ''
      const lower = raw.toLowerCase()
      let type: 'session' | 'network' | 'unknown' = 'unknown'
      if (lower.includes('session not found') || lower.includes('not found')) {
        type = 'session'
      } else if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('econnrefused')) {
        type = 'network'
      }
      setLastError({ type, message: raw || 'unknown_error' })
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
    if (!chatError) return
    setStreamPhase(null)
    const raw = chatError.message || ''
    const lower = raw.toLowerCase()
    let type: 'session' | 'network' | 'unknown' = 'unknown'
    if (lower.includes('session not found') || lower.includes('not found')) {
      type = 'session'
    } else if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('econnrefused')) {
      type = 'network'
    }
    setLastError({ type, message: raw || 'unknown_error' })
  }, [chatError])

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
  const messages: NotebookChatMessage[] = useMemo(() => {
    return displayAiMessages.map(msg => convertToNotebookChatMessage(msg, citationsMap))
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

  // Send pending message when session ID is ready
  useEffect(() => {
    if (pendingMessage && currentSessionId === pendingMessage.sessionId) {
      // Use setTimeout to ensure useChat has updated its api URL after state change
      const timer = setTimeout(() => {
        console.log('[useNotebookChatV2] Sending pending message for session:', currentSessionId)
        const lastAssistant = [...aiMessagesRef.current].reverse().find(m => m.role === 'assistant')
        setTypewriterBaselineId(lastAssistant?.id ?? null)
        setTypewriterEnabled(true)
        sendChatMessage({
          text: pendingMessage.message
        }, {
          body: {
            notesContext: pendingMessage.notesContext,
            model: pendingMessage.modelOverride || pendingModelOverride || currentSession?.model_override
          }
        })
        setPendingMessage(null)
      }, 100) // Small delay to ensure useChat has re-rendered with new api URL

      return () => clearTimeout(timer)
    }
  }, [currentSessionId, pendingMessage, pendingModelOverride, currentSession?.model_override, sendChatMessage])

  // Build context from sources and notes based on user selections
  const buildContext = useCallback(async () => {
    const context_config: { sources: Record<string, string>, notes: Record<string, string> } = {
      sources: {},
      notes: {}
    }

    sources.forEach(source => {
      const mode = contextSelections.sources[source.id]
      if (mode === 'insights') {
        context_config.sources[source.id] = 'insights'
      } else if (mode === 'full') {
        context_config.sources[source.id] = 'full content'
      } else {
        context_config.sources[source.id] = 'not in'
      }
    })

    notes.forEach(note => {
      const mode = contextSelections.notes[note.id]
      if (mode === 'full') {
        context_config.notes[note.id] = 'full content'
      } else {
        context_config.notes[note.id] = 'not in'
      }
    })

    const response = await chatApi.buildContext({
      notebook_id: notebookId,
      context_config
    })

    setTokenCount(response.token_count)
    setCharCount(response.char_count)

    return response.context
  }, [notebookId, sources, notes, contextSelections])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: CreateNotebookChatSessionRequest) =>
      chatApi.createSession(data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      setCurrentSessionId(newSession.id)
      setMessages([])
      setCitationsMap(new Map())
      setLastError(null)
      toast.success('Chat session created')
    },
    onError: () => {
      toast.error('Failed to create chat session')
    }
  })

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string
      data: UpdateNotebookChatSessionRequest
    }) => chatApi.updateSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSession(currentSessionId!)
      })
      toast.success('Session updated')
    },
    onError: () => {
      toast.error('Failed to update session')
    }
  })

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      chatApi.deleteSession(sessionId),
    onSuccess: (_, deletedId) => {
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null)
        setMessages([])
        setCitationsMap(new Map())
      }
      queryClient.removeQueries({
        queryKey: QUERY_KEYS.notebookChatSession(deletedId)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      toast.success('Session deleted')
    },
    onError: () => {
      toast.error('Failed to delete session')
    }
  })

  // Send message - auto-create session if needed
  const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
    setLastError(null)
    setStreamPhase(null)
    lastUserMessageRef.current = { message, modelOverride }
    let sessionId = currentSessionId

    // Build context for notes
    let notesContext = ''
    try {
      const context = await buildContext()
      if (context?.notes?.length) {
        const noteItems = context.notes as Array<{ title?: string | null; content?: string | null }>
        const noteText = noteItems
          .map((note) => {
            const content = note.content?.trim() || ''
            if (!content) return ''
            const title = note.title ? `# ${note.title}` : '# Note'
            return `${title}\n${content}`
          })
          .filter(Boolean)
          .join('\n\n')
        if (noteText) {
          notesContext = `Use the following notes as additional context. Do not invent details beyond the notes.\n\n${noteText}`
        }
      }
    } catch (error) {
      console.error('Error building context:', error)
    }

    // Auto-create session if none exists
    if (!sessionId) {
      try {
        const defaultTitle = message.length > 30 ? `${message.substring(0, 30)}...` : message
        const newSession = await chatApi.createSession({
          notebook_id: notebookId,
          title: defaultTitle,
          model_override: pendingModelOverride ?? undefined
        })
        sessionId = newSession.id
        // Set pending message to be sent after state update
        setPendingMessage({
          message,
          modelOverride,
          sessionId,
          notesContext
        })
        setCurrentSessionId(sessionId)
        setPendingModelOverride(null)
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
        })
        // Return early - the useEffect will handle sending the message
        return
      } catch (error) {
        console.error('Failed to create chat session:', error)
        setLastError({
          type: 'network',
          message: error instanceof Error ? error.message : 'create_session_failed',
        })
        toast.error('Failed to create chat session')
        return
      }
    }

    // Session already exists, send message directly
    const lastAssistant = [...aiMessagesRef.current].reverse().find(m => m.role === 'assistant')
    setTypewriterBaselineId(lastAssistant?.id ?? null)
    setTypewriterEnabled(true)
    sendChatMessage({
      text: message
    }, {
      body: {
        notesContext,
        model: modelOverride || pendingModelOverride || currentSession?.model_override
      }
    })
  }, [notebookId, currentSessionId, currentSession, pendingModelOverride, sendChatMessage, queryClient, buildContext])

  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current) return
    const { message, modelOverride } = lastUserMessageRef.current
    await sendMessage(message, modelOverride)
  }, [sendMessage])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
    setMessages([])
    setCitationsMap(new Map())
    setLastError(null)
    setTypewriterBaselineId(null)
    setTypewriterEnabled(false)
  }, [setMessages])

  // Create session
  const createSession = useCallback((title?: string) => {
    return createSessionMutation.mutate({
      notebook_id: notebookId,
      title
    })
  }, [createSessionMutation, notebookId])

  // Update session
  const updateSession = useCallback((sessionId: string, data: UpdateNotebookChatSessionRequest) => {
    return updateSessionMutation.mutate({
      sessionId,
      data
    })
  }, [updateSessionMutation])

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    return deleteSessionMutation.mutate(sessionId)
  }, [deleteSessionMutation])

  const resetSession = useCallback(() => {
    setCurrentSessionId(null)
    setMessages([])
    setCitationsMap(new Map())
    setPendingMessage(null)
    setPendingModelOverride(null)
    setLastError(null)
    setTypewriterBaselineId(null)
    setTypewriterEnabled(false)
  }, [setMessages])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  // Set model override
  const setModelOverride = useCallback((model: string | null) => {
    if (currentSessionId) {
      updateSessionMutation.mutate({
        sessionId: currentSessionId,
        data: { model_override: model }
      })
    } else {
      setPendingModelOverride(model)
    }
  }, [currentSessionId, updateSessionMutation])

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    stop()
  }, [stop])

  // Update token/char counts when context selections change
  useEffect(() => {
    const updateContextCounts = async () => {
      try {
        await buildContext()
      } catch (error) {
        console.error('Error updating context counts:', error)
      }
    }
    updateContextCounts()
  }, [buildContext])

  return {
    // State
    sessions,
    currentSession: currentSession || sessions.find(s => s.id === currentSessionId),
    currentSessionId,
    messages,
    isSending: isStreaming,
    streamStatus: status,
    loadingSessions,
    tokenCount,
    charCount,
    pendingModelOverride,
    lastError,
    streamPhase,

    // Actions
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    sendMessage,
    setModelOverride,
    cancelStreaming,
    refetchSessions,
    resetSession,
    clearError,
    retryLastMessage
  }
}


