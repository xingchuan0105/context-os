import apiClient from './client'
import {
  NotebookChatSession,
  NotebookChatSessionWithMessages,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SendNotebookChatMessageRequest,
  NotebookChatMessage,
  BuildContextRequest,
  BuildContextResponse,
  ChatCitation,
} from '@/lib/types/api'
import { getAuthToken } from '@/lib/auth/token-utils'

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
}

type LayerType = 'document' | 'parent' | 'child'

const isValidLayer = (layer: string | undefined): layer is LayerType => {
  return layer === 'document' || layer === 'parent' || layer === 'child'
}

const normalizeNotebookMessage = (raw: unknown): NotebookChatMessage => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid chat message payload')
  }
  const message = raw as {
    id?: string | number
    type?: string
    role?: string
    content?: string
    timestamp?: string
    createdAt?: string
    created_at?: string
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

  const role = message.role?.toLowerCase()
  const rawType = message.type?.toLowerCase()
  const type =
    rawType === 'human' || rawType === 'ai'
      ? rawType
      : role === 'user'
        ? 'human'
        : role === 'assistant'
          ? 'ai'
          : 'ai'

  // Normalize citations to ensure layer type is correct
  const normalizedCitations: ChatCitation[] | undefined = message.citations?.map(c => ({
    ...c,
    layer: isValidLayer(c.layer) ? c.layer : undefined
  }))

  return {
    id: message.id !== undefined ? String(message.id) : `msg-${Date.now()}`,
    type,
    content: message.content ?? '',
    timestamp: message.timestamp ?? message.createdAt ?? message.created_at,
    citations: normalizedCitations,
  }
}

const normalizeNotebookMessages = (raw: unknown): NotebookChatMessage[] => {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeNotebookMessage)
}

const normalizeNotebookSession = (raw: unknown): NotebookChatSession => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid chat session payload')
  }
  const session = raw as {
    id?: string
    notebook_id?: string
    kb_id?: string
    kbId?: string
    title?: string
    created?: string
    createdAt?: string
    updated?: string
    updatedAt?: string
    message_count?: number
    messageCount?: number
    model_override?: string | null
    modelOverride?: string | null
  }

  if (!session.id) {
    throw new Error('Chat session id missing')
  }

  return {
    id: session.id,
    notebook_id: session.notebook_id ?? session.kb_id ?? session.kbId ?? '',
    title: session.title ?? '',
    created: session.created ?? session.createdAt ?? '',
    updated: session.updated ?? session.updatedAt ?? '',
    message_count: session.message_count ?? session.messageCount,
    model_override: session.model_override ?? session.modelOverride ?? null,
  }
}

const unwrapSessions = (payload: unknown): NotebookChatSession[] => {
  if (Array.isArray(payload)) {
    return payload.map(normalizeNotebookSession)
  }
  if (payload && typeof payload === 'object') {
    const envelope = payload as ApiEnvelope<{ sessions?: unknown }>
    const sessions = envelope.data && (envelope.data as { sessions?: unknown }).sessions
    if (Array.isArray(sessions)) {
      return sessions.map(normalizeNotebookSession)
    }
  }
  return []
}

const unwrapSession = (payload: unknown): NotebookChatSession => {
  if (payload && typeof payload === 'object') {
    const envelope = payload as ApiEnvelope<{ session?: unknown }>
    const session = envelope.data && (envelope.data as { session?: unknown }).session
    if (session) {
      return normalizeNotebookSession(session)
    }
  }
  return normalizeNotebookSession(payload)
}

const unwrapSessionDetail = (payload: unknown): NotebookChatSessionWithMessages => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid chat session detail payload')
  }
  const detail = payload as {
    session?: unknown
    messages?: unknown
  }
  if (detail.session) {
    return {
      ...normalizeNotebookSession(detail.session),
      messages: normalizeNotebookMessages(detail.messages),
    }
  }
  return {
    ...normalizeNotebookSession(detail),
    messages: normalizeNotebookMessages(detail.messages),
  }
}

export const chatApi = {
  // Session management
  listSessions: async (notebookId: string) => {
    const response = await apiClient.get<NotebookChatSession[]>(
      `/chat/sessions`,
      { params: { kb_id: notebookId } }
    )
    return unwrapSessions(response.data)
  },

  createSession: async (data: CreateNotebookChatSessionRequest) => {
    const { notebook_id, ...rest } = data
    const payload = {
      ...rest,
      kb_id: notebook_id,
    }
    const response = await apiClient.post<NotebookChatSession>(
      `/chat/sessions`,
      payload
    )
    return unwrapSession(response.data)
  },

  getSession: async (sessionId: string) => {
    const response = await apiClient.get<NotebookChatSessionWithMessages>(
      `/chat/sessions/${sessionId}`
    )
    return unwrapSessionDetail(response.data)
  },

  updateSession: async (sessionId: string, data: UpdateNotebookChatSessionRequest) => {
    const response = await apiClient.patch<NotebookChatSession>(
      `/chat/sessions/${sessionId}`,
      data
    )
    return unwrapSession(response.data)
  },

  deleteSession: async (sessionId: string) => {
    await apiClient.delete(`/chat/sessions/${sessionId}`)
  },

  // Messaging (synchronous, no streaming)
  sendMessage: async (data: SendNotebookChatMessageRequest) => {
    const response = await apiClient.post<{
      session_id: string
      messages: NotebookChatMessage[]
    }>(
      `/chat/execute`,
      data
    )
    return {
      ...response.data,
      messages: normalizeNotebookMessages(response.data.messages),
    }
  },

  // Messaging (streaming via SSE)
  sendMessageStream: async (
    sessionId: string,
    data: {
      message: string
      selectedSourceIds: string[]
      model?: string
      systemPrompt?: string
    }
  ) => {
    const token = getAuthToken()

    const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        message: data.message,
        selectedSourceIds: data.selectedSourceIds,
        model: data.model,
        systemPrompt: data.systemPrompt,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.body
  },

  buildContext: async (data: BuildContextRequest) => {
    const response = await apiClient.post<BuildContextResponse>(
      `/chat/context`,
      data
    )
    return response.data
  },
}

export default chatApi
