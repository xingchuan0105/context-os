/**
 * Chat Service
 *
 * High-level service methods for chat session and message management
 */

import type {
  ChatSession,
  ChatMessage,
  CreateChatSessionRequest,
  CreateChatSessionResponse,
  SendChatMessageRequest,
  SendChatMessageResponse,
  ListChatSessionsRequest,
  ListChatSessionsResponse,
  GetChatSessionRequest,
  GetChatSessionResponse,
  DeleteChatSessionRequest,
} from '../types'
import { apiClient, type APIClient } from '../client/index.js'

// ==================== Service Interface ====================

export interface ChatService {
  listSessions(request?: ListChatSessionsRequest): Promise<ListChatSessionsResponse>
  createSession(request?: CreateChatSessionRequest): Promise<CreateChatSessionResponse>
  getSession(request: GetChatSessionRequest): Promise<GetChatSessionResponse>
  deleteSession(request: DeleteChatSessionRequest): Promise<void>
  sendMessage(request: SendChatMessageRequest): Promise<SendChatMessageResponse>
  getMessages(sessionId: string): Promise<ChatMessage[]>
}

// ==================== Implementation ====================

/**
 * Chat Service Implementation
 */
class ChatServiceImpl implements ChatService {
  constructor(private client: APIClient = apiClient) {}

  /**
   * List all chat sessions
   *
   * @param request - Optional filter by knowledge base
   * @returns Promise of chat sessions array
   *
   * @example
   * const sessions = await chatService.listSessions()
   * console.log(sessions.map(s => s.title))
   */
  async listSessions(request?: ListChatSessionsRequest): Promise<ListChatSessionsResponse> {
    const params: Record<string, string | undefined> = {}

    if (request?.kbId) {
      params.kb_id = request.kbId
    }

    return this.client.get<ListChatSessionsResponse>('/chat/sessions', params)
  }

  /**
   * Create a new chat session
   *
   * @param request - Optional session configuration
   * @returns Promise of created session
   *
   * @example
   * const { session } = await chatService.createSession({
   *   kbId: 'kb-123',
   *   title: 'Chat about AI'
   * })
   */
  async createSession(request?: CreateChatSessionRequest): Promise<CreateChatSessionResponse> {
    return this.client.post<CreateChatSessionResponse>('/chat/sessions', request || {})
  }

  /**
   * Get a chat session with its messages
   *
   * @param request - Get session request
   * @returns Promise of session with messages
   *
   * @example
   * const { session, messages } = await chatService.getSession({
   *   sessionId: 'session-123'
   * })
   */
  async getSession(request: GetChatSessionRequest): Promise<GetChatSessionResponse> {
    return this.client.get<GetChatSessionResponse>(
      `/chat/sessions/${request.sessionId}`
    )
  }

  /**
   * Delete a chat session
   *
   * @param request - Delete session request
   * @returns Promise that resolves when deleted
   *
   * @example
   * await chatService.deleteSession({ sessionId: 'session-123' })
   * console.log('Session deleted')
   */
  async deleteSession(request: DeleteChatSessionRequest): Promise<void> {
    await this.client.delete(`/chat/sessions/${request.sessionId}`)
  }

  /**
   * Send a message in a chat session
   *
   * @param request - Send message request
   * @returns Promise of sent message and updated session
   *
   * @example
   * const { message, session } = await chatService.sendMessage({
   *   sessionId: 'session-123',
   *   content: 'What is RAG?'
   * })
   */
  async sendMessage(request: SendChatMessageRequest): Promise<SendChatMessageResponse> {
    return this.client.post<SendChatMessageResponse>(
      `/chat/sessions/${request.sessionId}/messages`,
      {
        message: request.content,
        selectedSourceIds: request.selectedSourceIds,
      }
    )
  }

  /**
   * Get all messages in a session
   *
   * @param sessionId - Session ID
   * @returns Promise of messages array
   *
   * @example
   * const messages = await chatService.getMessages('session-123')
   * messages.forEach(msg => console.log(`${msg.role}: ${msg.content}`))
   */
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const { messages } = await this.getSession({ sessionId })
    return messages
  }

  /**
   * Quick chat: Create session and send first message
   *
   * @param content - First message content
   * @param kbId - Optional knowledge base ID
   * @returns Promise of message and session
   *
   * @example
   * const { message, session } = await chatService.quickChat(
   *   'Explain RAG in simple terms',
   *   'kb-123'
   * )
   */
  async quickChat(
    content: string,
    kbId?: string
  ): Promise<SendChatMessageResponse> {
    // Create session
    const { session } = await this.createSession({ kbId })

    // Send first message
    return this.sendMessage({
      sessionId: session.id,
      content,
    })
  }

  /**
   * Chat in existing session
   *
   * @param sessionId - Session ID
   * @param content - Message content
   * @returns Promise of assistant response
   *
   * @example
   * const response = await chatService.chat('session-123', 'Tell me more')
   * console.log('Assistant:', response.message.content)
   */
  async chat(
    sessionId: string,
    content: string
  ): Promise<SendChatMessageResponse> {
    return this.sendMessage({ sessionId, content })
  }

  /**
   * Stream chat response (if streaming is supported)
   *
   * Note: This is a placeholder for future streaming implementation
   *
   * @param sessionId - Session ID
   * @param content - Message content
   * @param onChunk - Callback for each chunk
   * @returns Promise of complete message
   *
   * @example
   * await chatService.streamChat(
   *   'session-123',
   *   'Explain quantum computing',
   *   (chunk) => console.log(chunk)
   * )
   */
  async streamChat(
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void
  ): Promise<SendChatMessageResponse> {
    // Note: Streaming endpoint may not exist yet
    // This is a placeholder for future implementation
    throw new Error('streamChat endpoint not implemented in backend yet')
  }
}

// ==================== Default Instance ====================

/**
 * Default chat service instance
 *
 * @example
 * import { chatService } from '@/lib/api/services'
 * const sessions = await chatService.listSessions()
 */
export const chatService = new ChatServiceImpl()

/**
 * Create a new chat service with custom client
 *
 * @param client - Custom API client
 * @returns ChatService instance
 *
 * @example
 * import { createAPIClient } from '@/lib/api/client'
 * import { createChatService } from '@/lib/api/services'
 *
 * const client = createAPIClient({ baseURL: '/api' })
 * const service = createChatService(client)
 */
export function createChatService(client?: APIClient): ChatService {
  return new ChatServiceImpl(client)
}
