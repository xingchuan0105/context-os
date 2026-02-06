import { apiClient } from './client'
import {
  ChatSessionResponse,
  ChatSessionDetailResponse,
  CreateChatSessionRequest,
  UpdateChatSessionRequest,
  ChatMessageResponse,
  ContextOSAPIResponse,
} from '@/lib/types/api'
import { unwrapContextOSResponse } from './response'
import { getApiUrl } from '@/lib/config'

/**
 * Context-OS Chat API
 */
export const chatApi = {
  // ==================== Sessions ====================

  /**
   * Get chat sessions for a knowledge base
   * GET /api/chat/sessions?kb_id={id}
   */
  getSessions: async (kbId: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<{ sessions: ChatSessionResponse[] }> | { sessions: ChatSessionResponse[] }
    >(`/chat/sessions?kb_id=${kbId}`)
    const data = unwrapContextOSResponse(response.data)
    return data.sessions
  },

  /**
   * Create a new chat session
   * POST /api/chat/sessions
   */
  createSession: async (data: CreateChatSessionRequest) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<{ session: ChatSessionResponse }> | { session: ChatSessionResponse }
    >(
      '/chat/sessions',
      data
    )
    const payload = unwrapContextOSResponse(response.data)
    return payload.session
  },

  /**
   * Get session details
   * GET /api/chat/sessions/{id}
   */
  getSessionById: async (id: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<ChatSessionDetailResponse> | ChatSessionDetailResponse
    >(
      `/chat/sessions/${id}`
    )
    return unwrapContextOSResponse(response.data)
  },

  /**
   * Update session
   * PATCH /api/chat/sessions/{id}
   */
  updateSession: async (id: string, data: UpdateChatSessionRequest) => {
    const response = await apiClient.patch<{ session: ChatSessionResponse }>(
      `/chat/sessions/${id}`,
      data
    )
    return response.data.session
  },

  /**
   * Delete a session
   * DELETE /api/chat/sessions/{id}
   */
  deleteSession: async (id: string) => {
    const response = await apiClient.delete<{ success: boolean }>(
      `/chat/sessions/${id}`
    )
    return response.data.success
  },

  // ==================== Messages ====================

  /**
   * Get messages for a session
   * GET /api/chat/sessions/{id}/messages
   */
  getMessages: async (sessionId: string) => {
    const detail = await chatApi.getSessionById(sessionId)
    return detail.messages as ChatMessageResponse[]
  },

  // ==================== Streaming Chat ====================

  /**
   * Stream chat response
   * POST /api/chat/stream
   * Returns a readable stream of Server-Sent Events
   */
  streamChat: async (
    sessionId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    options?: { selectedSourceIds?: string[]; systemPrompt?: string }
  ) => {
    try {
      const selectedSourceIds = options?.selectedSourceIds ?? []

      const apiUrl = await getApiUrl()
      const useSessionEndpoint = selectedSourceIds.length > 0
      const url = useSessionEndpoint
        ? `${apiUrl}/api/chat/sessions/${sessionId}/messages`
        : `${apiUrl}/api/chat/stream`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message,
          ...(useSessionEndpoint ? { selectedSourceIds } : {}),
          systemPrompt: options?.systemPrompt,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          onComplete()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) {
            continue
          }
          const data = trimmed.slice(5).trim()

          if (data === '[DONE]') {
            onComplete()
            return
          }

          try {
            const parsed = JSON.parse(data) as { type?: string; data?: any }
            if (parsed.type === 'token' && parsed.data?.content) {
              onChunk(parsed.data.content)
            } else if (parsed.type === 'done') {
              onComplete()
              return
            } else if (parsed.type === 'error') {
              onError(parsed.data?.message || 'Unknown error')
              return
            }
          } catch (error) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unknown error')
    }
  },
}
