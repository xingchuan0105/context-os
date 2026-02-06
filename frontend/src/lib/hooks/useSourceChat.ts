'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sourceChatApi } from '@/lib/api/source-chat'
import {
  SourceChatSession,
  SourceChatMessage,
  SourceChatContextIndicator,
  CreateSourceChatSessionRequest,
  UpdateSourceChatSessionRequest
} from '@/lib/types/api'

export function useSourceChat(sourceId: string, locale?: string) {
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SourceChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [contextIndicators, setContextIndicators] = useState<SourceChatContextIndicator | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isStreamingRef = useRef(false)

  // Fetch sessions
  const { data: sessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useQuery<SourceChatSession[]>({
    queryKey: ['sourceChatSessions', sourceId],
    queryFn: () => sourceChatApi.listSessions(sourceId),
    enabled: !!sourceId
  })

  // Fetch current session with messages
  const { data: currentSession, refetch: refetchCurrentSession } = useQuery({
    queryKey: ['sourceChatSession', sourceId, currentSessionId],
    queryFn: () => sourceChatApi.getSession(sourceId, currentSessionId!),
    enabled: !!sourceId && !!currentSessionId,
    // Disable automatic refetching to prevent overwriting streaming messages
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity
  })

  // Update messages when session changes
  // Only sync when local messages are empty (e.g., on session switch or initial load)
  // This prevents overwriting streaming messages
  useEffect(() => {
    console.log('[useSourceChat] useEffect triggered', {
      hasServerMessages: !!currentSession?.messages,
      serverMessageCount: currentSession?.messages?.length,
      localMessageCount: messages.length,
      isStreamingRef: isStreamingRef.current,
      currentSessionId
    })
    // Only sync if:
    // 1. Server has messages
    // 2. Not currently streaming
    // 3. Session ID is valid
    // 4. Local messages are empty (prevents overwriting streaming messages)
    if (currentSession?.messages && !isStreamingRef.current && currentSessionId && messages.length === 0) {
      console.log('[useSourceChat] Syncing messages from server:', currentSession.messages.length)
      setMessages(currentSession.messages)
    }
  }, [currentSession, currentSessionId, messages.length])

  // Auto-select most recent session when sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      // Find most recent session (sessions are sorted by created date desc from API)
      const mostRecentSession = sessions[0]
      setCurrentSessionId(mostRecentSession.id)
    }
  }, [sessions, currentSessionId])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: Omit<CreateSourceChatSessionRequest, 'source_id'>) => 
      sourceChatApi.createSession(sourceId, data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
      setCurrentSessionId(newSession.id)
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
      // 1. First clear local state if deleting current session
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null)
        setMessages([])
      }
      // 2. Remove the specific session query cache to prevent useEffect from restoring old data
      queryClient.removeQueries({ queryKey: ['sourceChatSession', sourceId, deletedId] })
      // 3. Then invalidate sessions list
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
      toast.success('Session deleted')
    },
    onError: () => {
      toast.error('Failed to delete session')
    }
  })

  // Send message with streaming
  const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
    let sessionId = currentSessionId

    // IMPORTANT: Set streaming flag FIRST to prevent useEffect from overwriting messages
    // This must happen before any state changes that could trigger React Query refetch
    isStreamingRef.current = true
    setIsStreaming(true)

    // Auto-create session if none exists
    if (!sessionId) {
      try {
        const defaultTitle = message.length > 30 ? `${message.substring(0, 30)}...` : message
        const newSession = await sourceChatApi.createSession(sourceId, { title: defaultTitle })
        sessionId = newSession.id
        setCurrentSessionId(sessionId)
        queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
      } catch (error) {
        isStreamingRef.current = false
        setIsStreaming(false)
        console.error('Failed to create chat session:', error)
        toast.error('Failed to create chat session')
        return
      }
    }

    // Add user message optimistically
    const userMessage: SourceChatMessage = {
      id: `tmp_user_${Date.now()}`,
      type: 'human',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const systemPrompt = locale
        ? locale === 'zh'
          ? 'Please respond in Chinese unless the user explicitly asks for another language.'
          : 'Please respond in English unless the user explicitly asks for another language.'
        : undefined

      const response = await sourceChatApi.sendMessage(sessionId, {
        message,
        model_override: modelOverride,
        ...(systemPrompt ? { systemPrompt } : {})
      })

      if (!response) {
        throw new Error('No response body')
      }

      const reader = response.getReader()
      const decoder = new TextDecoder()
      let aiMessage: SourceChatMessage | null = null
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) {
            continue
          }
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'token') {
              // Handle streaming token from backend
              const tokenContent = data.data?.content || ''
              if (!aiMessage) {
                aiMessage = {
                  id: `ai-${Date.now()}`,
                  type: 'ai',
                  content: tokenContent,
                  timestamp: new Date().toISOString()
                }
                setMessages(prev => [...prev, aiMessage!])
              } else {
                aiMessage.content += tokenContent
                setMessages(prev =>
                  prev.map(msg => msg.id === aiMessage!.id
                    ? { ...msg, content: aiMessage!.content }
                    : msg
                  )
                )
              }
            } else if (data.type === 'done') {
              // Debug: log citations data from SSE
              console.log('[SSE Done]', {
                hasCitations: !!data.data?.citations,
                count: data.data?.citations?.length || 0,
                citations: data.data?.citations
              })
              // Handle done event with citations
              if (aiMessage && data.data?.citations) {
                aiMessage.citations = data.data.citations
                setMessages(prev =>
                  prev.map(msg => msg.id === aiMessage!.id
                    ? { ...msg, citations: data.data.citations }
                    : msg
                  )
                )
              }
            } else if (data.type === 'ai_message') {
              // Legacy format support
              if (!aiMessage) {
                aiMessage = {
                  id: `ai-${Date.now()}`,
                  type: 'ai',
                  content: data.content || '',
                  timestamp: new Date().toISOString()
                }
                setMessages(prev => [...prev, aiMessage!])
              } else {
                aiMessage.content += data.content || ''
                setMessages(prev =>
                  prev.map(msg => msg.id === aiMessage!.id
                    ? { ...msg, content: aiMessage!.content }
                    : msg
                  )
                )
              }
            } else if (data.type === 'context_indicators') {
              setContextIndicators(data.data)
            } else if (data.type === 'error') {
              throw new Error(data.data?.message || data.message || 'Stream error')
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e)
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      // Remove optimistic messages on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('tmp_')))
    } finally {
      // Reset state - messages are already correct from streaming
      // Don't refetch here as it would trigger useEffect and potentially overwrite messages
      // The cache will be updated on next session switch
      isStreamingRef.current = false
      setIsStreaming(false)
    }
  }, [sourceId, currentSessionId, locale, refetchCurrentSession, queryClient])

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      isStreamingRef.current = false
      setIsStreaming(false)
    }
  }, [])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
    setMessages([])  // Clear messages so useEffect can load new session's messages
    setContextIndicators(null)
  }, [])

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

  return {
    // State
    sessions,
    currentSession: sessions.find(s => s.id === currentSessionId),
    currentSessionId,
    messages,
    isStreaming,
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
