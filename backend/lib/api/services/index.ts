/**
 * API Services
 *
 * High-level service layer for frontend consumption
 * Exports all service modules
 */

export { documentsService, createDocumentsService } from './documents'
export { knowledgeBasesService, createKnowledgeBasesService } from './knowledge-bases'
export { searchService, createSearchService } from './search'
export { chatService, createChatService } from './chat'

// Re-export types for convenience
export type {
  DocumentsService,
} from './documents'
export type {
  KnowledgeBasesService,
} from './knowledge-bases'
export type {
  SearchService,
} from './search'
export type {
  ChatService,
} from './chat'

// ==================== Service Aggregation ====================

// Import for use in api object (Turbopack workaround)
import { documentsService, createDocumentsService } from './documents.js'
import { knowledgeBasesService, createKnowledgeBasesService } from './knowledge-bases.js'
import { searchService, createSearchService } from './search.js'
import { chatService, createChatService } from './chat.js'

/**
 * All API services in one object
 *
 * @example
 * import { api } from '@/lib/api/services'
 * const documents = await api.documents.list({ kbId: 'kb-123' })
 * const results = await api.search.search({ query: 'RAG' })
 */
export const api = {
  documents: documentsService,
  knowledgeBases: knowledgeBasesService,
  search: searchService,
  chat: chatService,
}

/**
 * Create API services with custom client
 *
 * @param client - Custom API client
 * @returns Object containing all services
 *
 * @example
 * import { createAPIClient } from '@/lib/api/client'
 * import { createAPI } from '@/lib/api/services'
 *
 * const client = createAPIClient({ baseURL: '/api' })
 * const { documents, search, chat } = createAPI(client)
 */
export function createAPI(client: import('../client/index.js').APIClient) {
  return {
    documents: createDocumentsService(client),
    knowledgeBases: createKnowledgeBasesService(client),
    search: createSearchService(client),
    chat: createChatService(client),
  }
}
