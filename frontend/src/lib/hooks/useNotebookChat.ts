'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { chatApi } from '@/lib/api/chat'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  NotebookChatMessage,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SourceListResponse,
  NoteResponse,
  ChatCitation
} from '@/lib/types/api'
import { ContextSelections } from '@/lib/types/common'

interface UseNotebookChatParams {
  notebookId: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
  contextSelections: ContextSelections
  locale?: string
}

type LayerType = 'document' | 'parent' | 'child'

const isValidLayer = (layer: string | undefined): layer is LayerType => {
  return layer === 'document' || layer === 'parent' || layer === 'child'
}

const normalizeCitations = (citations: unknown): ChatCitation[] | undefined => {
  if (!Array.isArray(citations)) return undefined
  return citations.map((c: Record<string, unknown>) => ({
    index: c.index as number,
    content: c.content as string,
    docId: c.docId as string,
    docName: c.docName as string,
    chunkIndex: c.chunkIndex as number | undefined,
    score: c.score as number | undefined,
    layer: isValidLayer(c.layer as string | undefined) ? (c.layer as LayerType) : undefined
  }))
}

export function useNotebookChat({ notebookId, sources, notes, contextSelections, locale }: UseNotebookChatParams) {
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<NotebookChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [tokenCount, setTokenCount] = useState<number>(0)
  const [charCount, setCharCount] = useState<number>(0)
  // Pending model override for when user changes model before a session exists
  const [pendingModelOverride, setPendingModelOverride] = useState<string | null>(null)
  // Ref to track sending state synchronously (prevents useEffect from overwriting optimistic updates)
  const isSendingRef = useRef(false)

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

  // Fetch current session with messages
  const {
    data: currentSession,
    refetch: refetchCurrentSession
  } = useQuery({
    queryKey: QUERY_KEYS.notebookChatSession(currentSessionId!),
    queryFn: () => chatApi.getSession(currentSessionId!),
    enabled: !!notebookId && !!currentSessionId,
    // Disable automatic refetching to prevent overwriting streaming messages
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity
  })

  // Update messages when current session changes
  // Only sync when local messages are empty (e.g., on session switch or initial load)
  // This prevents overwriting streaming messages
  useEffect(() => {
    console.log('[useNotebookChat] useEffect triggered', {
      hasMessages: !!currentSession?.messages,
      serverMessageCount: currentSession?.messages?.length,
      localMessageCount: messages.length,
      isSendingRef: isSendingRef.current,
      currentSessionId
    })
    // Only sync if:
    // 1. Server has messages
    // 2. Not currently sending
    // 3. Session ID is valid
    // 4. Local messages are empty (prevents overwriting streaming messages)
    if (currentSession?.messages && !isSendingRef.current && currentSessionId && messages.length === 0) {
      console.log('[useNotebookChat] Syncing messages from server')
      setMessages(currentSession.messages)
    }
  }, [currentSession, currentSessionId, messages.length])

  // Auto-select most recent session when sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      // Sessions are sorted by created date desc from API
      const mostRecentSession = sessions[0]
      setCurrentSessionId(mostRecentSession.id)
    }
  }, [sessions, currentSessionId])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: CreateNotebookChatSessionRequest) =>
      chatApi.createSession(data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      setCurrentSessionId(newSession.id)
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
      // 1. First clear local state if deleting current session
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null)
        setMessages([])
      }
      // 2. Remove the specific session query cache to prevent useEffect from restoring old data
      queryClient.removeQueries({
        queryKey: QUERY_KEYS.notebookChatSession(deletedId)
      })
      // 3. Then invalidate sessions list
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      toast.success('Session deleted')
    },
    onError: () => {
      toast.error('Failed to delete session')
    }
  })

  // Build context from sources and notes based on user selections
  const buildContext = useCallback(async () => {
    // Build context_config mapping IDs to selection modes
    const context_config: { sources: Record<string, string>, notes: Record<string, string> } = {
      sources: {},
      notes: {}
    }

    // Map source selections
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

    // Map note selections
    notes.forEach(note => {
      const mode = contextSelections.notes[note.id]
      if (mode === 'full') {
        context_config.notes[note.id] = 'full content'
      } else {
        context_config.notes[note.id] = 'not in'
      }
    })

    // Call API to build context with actual content
    const response = await chatApi.buildContext({
      notebook_id: notebookId,
      context_config
    })

    // Store token and char counts
    setTokenCount(response.token_count)
    setCharCount(response.char_count)

    return response.context
  }, [notebookId, sources, notes, contextSelections])

  // Send message (streaming)
  const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
    let sessionId = currentSessionId

    // IMPORTANT: Set sending flag FIRST to prevent useEffect from overwriting messages
    // This must happen before any state changes that could trigger React Query refetch
    isSendingRef.current = true
    setIsSending(true)

    // Auto-create session if none exists
    if (!sessionId) {
      try {
        const defaultTitle = message.length > 30
          ? `${message.substring(0, 30)}...`
          : message
        const newSession = await chatApi.createSession({
          notebook_id: notebookId,
          title: defaultTitle,
          // Include pending model override when creating session
          model_override: pendingModelOverride ?? undefined
        })
        sessionId = newSession.id
        setCurrentSessionId(sessionId)
        // Clear pending model override now that it's applied to the session
        setPendingModelOverride(null)
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
        })
      } catch {
        isSendingRef.current = false
        setIsSending(false)
        toast.error('Failed to create chat session')
        return
      }
    }

    // Add user message optimistically
    const userMessage: NotebookChatMessage = {
      id: `tmp_user_${Date.now()}`,
      type: 'human',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])

    const selectedSourceIds = sources
      .filter((source) => contextSelections.sources[source.id] !== 'off')
      .map((source) => source.id)

    const languageInstruction =
      locale === 'zh'
        ? '请用中文回答，除非用户明确要求英文。'
        : 'Please respond in English unless the user explicitly asks for another language.'
    let systemPrompt: string | undefined = languageInstruction
    try {
      const context = await buildContext()
      const promptParts: string[] = [languageInstruction]

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
          promptParts.push(
            `Use the following notes as additional context. Do not invent details beyond the notes.\n\n${noteText}`
          )
        }
      }
      systemPrompt = promptParts.join('\n\n')
    } catch (error) {
      console.error('Error building context:', error)
    }

    let aiMessageId: string | null = null
    let hasAiMessage = false

    try {
      const stream = await chatApi.sendMessageStream(sessionId, {
        message,
        selectedSourceIds,
        model: modelOverride ?? (currentSession?.model_override ?? undefined),
        systemPrompt,
      })

      if (!stream) {
        throw new Error('No response body')
      }

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      aiMessageId = `ai-${Date.now()}`

      const appendAiMessage = (chunk: string) => {
        if (!chunk) return
        setMessages(prev => {
          if (!hasAiMessage) {
            hasAiMessage = true
            return [
              ...prev,
              {
                id: aiMessageId!,
                type: 'ai',
                content: chunk,
                timestamp: new Date().toISOString(),
              },
            ]
          }
          return prev.map(msg =>
            msg.id === aiMessageId
              ? { ...msg, content: `${msg.content}${chunk}` }
              : msg
          )
        })
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) {
            continue
          }
          const payload = trimmed.slice(5).trim()
          if (!payload) {
            continue
          }
          if (payload === '[DONE]') {
            break
          }
          try {
            const event = JSON.parse(payload) as {
              type?: string
              data?: {
                content?: string
                message?: string
                id?: string | number
                citations?: Array<{
                  index: number
                  content: string
                  docId: string
                  docName: string
                  chunkIndex?: number
                  score?: number
                  layer?: string
                }>
              }
            }

            if (event.type === 'token') {
              appendAiMessage(event.data?.content || '')
            } else if (event.type === 'user' && event.data?.id) {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === userMessage.id ? { ...msg, id: String(event.data?.id) } : msg
                )
              )
            } else if (event.type === 'done') {
              const doneContent = event.data?.content ?? ''
              const doneId = event.data?.id
              const doneCitations = normalizeCitations(event.data?.citations)
              const currentAiMessageId = aiMessageId
              const finalId = doneId !== undefined ? String(doneId) : currentAiMessageId

              if (!hasAiMessage && !doneContent) {
                continue
              }

              setMessages(prev => {
                if (!hasAiMessage) {
                  hasAiMessage = true
                  return [
                    ...prev,
                    {
                      id: finalId || `ai-${Date.now()}`,
                      type: 'ai' as const,
                      content: doneContent,
                      timestamp: new Date().toISOString(),
                      citations: doneCitations,
                    },
                  ]
                }
                return prev.map(msg =>
                  msg.id === currentAiMessageId
                    ? {
                        ...msg,
                        id: finalId || msg.id,
                        content: doneContent || msg.content,
                        citations: doneCitations || msg.citations,
                      }
                    : msg
                )
              })

              if (doneId !== undefined) {
                aiMessageId = String(doneId)
              }
            } else if (event.type === 'error') {
              throw new Error(event.data?.message || 'Stream error')
            }
          } catch (parseError) {
            console.error('Error parsing SSE data:', parseError)
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      setMessages(prev => {
        const idsToRemove = new Set<string>([userMessage.id])
        if (aiMessageId) {
          idsToRemove.add(aiMessageId)
        }
        return prev.filter(msg => !idsToRemove.has(msg.id))
      })
    } finally {
      // Reset state - messages are already correct from streaming
      // Don't refetch here as it would trigger useEffect and potentially overwrite messages
      // The cache will be updated on next session switch
      isSendingRef.current = false
      setIsSending(false)
    }
  }, [
    notebookId,
    currentSessionId,
    currentSession,
    pendingModelOverride,
    buildContext,
    sources,
    contextSelections.sources,
    locale,
    refetchCurrentSession,
    queryClient
  ])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
    setMessages([])  // Clear messages so useEffect can load new session's messages
  }, [])

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

  // Set model override - handles both existing sessions and pending state
  const setModelOverride = useCallback((model: string | null) => {
    if (currentSessionId) {
      // Session exists - update it directly
      updateSessionMutation.mutate({
        sessionId: currentSessionId,
        data: { model_override: model }
      })
    } else {
      // No session yet - store as pending
      setPendingModelOverride(model)
    }
  }, [currentSessionId, updateSessionMutation])

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
    isSending,
    loadingSessions,
    tokenCount,
    charCount,
    pendingModelOverride,

    // Actions
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    sendMessage,
    setModelOverride,
    refetchSessions
  }
}
