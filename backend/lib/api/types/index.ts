/**
 * API Type Definitions
 *
 * Shared types between backend and frontend
 * Provides type safety for API requests and responses
 */

// ==================== Common Types ====================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: APIError
  timestamp: string
}

/**
 * Standard API error structure
 */
export interface APIError {
  code: string
  message: string
  details?: unknown
  timestamp: string
  requestId?: string
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  success: true
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  timestamp: string
}

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc'

/**
 * Sort parameters
 */
export interface SortParams {
  field?: string
  order?: SortOrder
}

// ==================== Document Types ====================

/**
 * Document processing status
 */
export type DocumentStatus = 'queued' | 'pending' | 'processing' | 'completed' | 'failed'

/**
 * Document metadata
 */
export interface DocumentMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string[]
  createdAt?: string
  modifiedAt?: string
  [key: string]: unknown
}

/**
 * Document entity
 */
export interface Document {
  id: string
  kb_id: string
  user_id: string
  file_name: string
  storage_path: string
  file_content?: string | null
  mime_type?: string | null
  file_size: number | null
  status: DocumentStatus
  error_message?: string | null
  ktype_summary?: string | null
  ktype_metadata?: string | null
  deep_summary?: string | null
  chunk_count: number | null
  created_at: string
  updated_at?: string | null
  url?: string
}

/**
 * Upload document request
 */
export interface UploadDocumentRequest {
  file: File
  kbId: string
  autoProcess?: boolean
}

/**
 * Upload document response
 */
export interface UploadDocumentResponse {
  document: Document
  documents?: Document[]
  autoProcessTriggered: boolean
  message: string
}

/**
 * Reprocess document response
 */
export interface ReprocessDocumentResponse {
  documentId: string
  status: DocumentStatus
}

/**
 * Document status response
 */
export interface DocumentStatusResponse {
  status: DocumentStatus
  progress: number
}

/**
 * List documents request
 */
export interface ListDocumentsRequest {
  kbId: string
  status?: DocumentStatus
  search?: string
}

/**
 * List documents response
 */
export type ListDocumentsResponse = Document[]

// ==================== Knowledge Base Types ====================

/**
 * Knowledge base entity
 */
export interface KnowledgeBase {
  id: string
  user_id: string
  name: string
  description?: string | null
  created_at: string
  updated_at: string
}

/**
 * Create knowledge base request
 */
export interface CreateKnowledgeBaseRequest {
  name: string
  description?: string
}

/**
 * Update knowledge base request
 */
export interface UpdateKnowledgeBaseRequest {
  id: string
  name?: string
  description?: string
}

/**
 * Delete knowledge base request
 */
export interface DeleteKnowledgeBaseRequest {
  id: string
}

/**
 * List knowledge bases response
 */
export type ListKnowledgeBasesResponse = KnowledgeBase[]

// ==================== Search Types ====================

/**
 * Search mode
 */
export type SearchMode = 'drill-down' | 'drill-down-relaxed' | 'flat'

/**
 * Search request
 */
export interface SearchRequest {
  query: string
  kbId?: string
  mode?: SearchMode
  topK?: number
  scoreThreshold?: number
  includeParent?: boolean
  rerank?: boolean
}

/**
 * Search result metadata
 */
export interface SearchResultMetadata {
  docId: string
  kbId: string
  type: 'parent' | 'child'
  chunkIndex: number
  [key: string]: unknown
}

/**
 * Search result item
 */
export interface SearchResult {
  content: string
  score: number
  docId: string
  kbId: string
  type: 'parent' | 'child'
  parentContent?: string | null
  metadata: SearchResultMetadata
}

/**
 * Document context (for drill-down search)
 */
export interface DocumentContext {
  score: number
  docId: string
  kbId: string
  summary: string
  metadata: SearchResultMetadata
}

/**
 * Parent chunk context
 */
export interface ParentContext {
  score: number
  content: string
  chunkIndex: number
}

/**
 * Search response context
 */
export interface SearchContext {
  document: DocumentContext | null
  parent: ParentContext | null
  children: Array<{
    score: number
    content: string
    chunkIndex: number
    metadata: SearchResultMetadata
  }>
}

/**
 * Drill-down search response
 */
export interface DrillDownSearchResponse {
  mode: 'drill-down'
  query: string
  context: SearchContext
  total: number
}

/**
 * Flat search response
 */
export interface FlatSearchResponse {
  mode: 'flat'
  query: string
  results: SearchResult[]
  total: number
}

/**
 * Search response (union type)
 */
export type SearchResponse = DrillDownSearchResponse | FlatSearchResponse

// ==================== Chat Types ====================

/**
 * Chat message role
 */
export type ChatMessageRole = 'user' | 'assistant' | 'system'

/**
 * Chat message
 */
export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  timestamp: string
}

/**
 * Chat session
 */
export interface ChatSession {
  id: string
  user_id: string
  kb_id?: string | null
  title: string
  created_at: string
  updated_at: string
  messages?: ChatMessage[]
}

/**
 * Create chat session request
 */
export interface CreateChatSessionRequest {
  kbId?: string
  title?: string
}

/**
 * Create chat session response
 */
export interface CreateChatSessionResponse {
  session: ChatSession
}

/**
 * Send chat message request
 */
export interface SendChatMessageRequest {
  sessionId: string
  content: string
  selectedSourceIds?: string[]
}

/**
 * Send chat message response
 */
export interface SendChatMessageResponse {
  message: ChatMessage
  session: ChatSession
}

/**
 * List chat sessions request
 */
export interface ListChatSessionsRequest {
  kbId?: string
}

/**
 * List chat sessions response
 */
export type ListChatSessionsResponse = ChatSession[]

/**
 * Get chat session detail request
 */
export interface GetChatSessionRequest {
  sessionId: string
}

/**
 * Get chat session detail response
 */
export interface GetChatSessionResponse {
  session: ChatSession
  messages: ChatMessage[]
}

/**
 * Delete chat session request
 */
export interface DeleteChatSessionRequest {
  sessionId: string
}

// ==================== Error Code Types ====================

/**
 * API error codes
 */
export type APICErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR'

/**
 * HTTP status codes
 */
export type HTTPStatusCode =
  | 200
  | 201
  | 204
  | 400
  | 401
  | 403
  | 404
  | 409
  | 500

// ==================== Client Configuration ====================

/**
 * API client configuration
 */
export interface APIClientConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
  getToken?: () => string | Promise<string>
  onRequest?: (config: RequestInit) => RequestInit | Promise<RequestInit>
  onResponse?: <T>(response: T) => T | Promise<T>
  onError?: (error: APIError) => void | Promise<void>
}

/**
 * Request options
 */
export interface RequestOptions {
  timeout?: number
  headers?: Record<string, string>
  signal?: AbortSignal
}

// ==================== Type Guards ====================

/**
 * Type guard for API response
 */
export function isAPIResponse<T>(value: unknown): value is APIResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'timestamp' in value
  )
}

/**
 * Type guard for paginated response
 */
export function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).success === true &&
    'pagination' in value &&
    Array.isArray((value as any).data)
  )
}

/**
 * Type guard for API error
 */
export function isAPIError(value: unknown): value is APIError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value
  )
}
