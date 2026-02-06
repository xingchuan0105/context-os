/**
 * Context-OS API Client
 *
 * Type-safe API client and service layer for frontend consumption
 *
 * @module lib/api
 *
 * @example
 * import { api, apiClient, documentsService } from '@/lib/api'
 *
 * // Use high-level services
 * const documents = await api.documents.list({ kbId: 'kb-123' })
 *
 * // Use individual services
 * const kb = await knowledgeBasesService.list()
 *
 * // Use low-level client
 * const data = await apiClient.get('/custom-endpoint')
 */

// ==================== Client ====================

// Due to Turbopack issues with re-exports, import directly from submodules
import { apiClient } from './client/index.js'
import { createAPIClient } from './client/index.js'
import { isAPIClientError } from './client/index.js'
import { APIClientError } from './client/index.js'
import { APIClient } from './client/index.js'

export { apiClient, createAPIClient, isAPIClientError, APIClientError, APIClient }
export type { APIClientConfig } from './types/index.js'
export type { RequestOptions } from './types/index.js'

// ==================== Services ====================

// Import for use in default export (Turbopack workaround)
import { api } from './services/index.js'
import { documentsService } from './services/index.js'
import { knowledgeBasesService } from './services/index.js'
import { searchService } from './services/index.js'
import { chatService } from './services/index.js'
import { createDocumentsService } from './services/index.js'
import { createKnowledgeBasesService } from './services/index.js'
import { createSearchService } from './services/index.js'
import { createChatService } from './services/index.js'
import { createAPI } from './services/index.js'

// Re-export for external consumers
export {
  api,
  documentsService,
  knowledgeBasesService,
  searchService,
  chatService,
  createDocumentsService,
  createKnowledgeBasesService,
  createSearchService,
  createChatService,
  createAPI,
  type DocumentsService,
  type KnowledgeBasesService,
  type SearchService,
  type ChatService,
} from './services'

// ==================== Types ====================

export type * from './types'

// ==================== Utilities ====================

export * from './utils'

// ==================== Re-exports for Convenience ====================

/**
 * Default export with everything
 */
export default {
  client: apiClient,
  api,
  services: {
    documents: documentsService,
    knowledgeBases: knowledgeBasesService,
    search: searchService,
    chat: chatService,
  },
}
