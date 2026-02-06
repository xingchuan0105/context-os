export interface NotebookResponse {
  id: string
  name: string
  description: string
  archived: boolean
  created: string
  updated: string
  source_count: number
  note_count: number
}

export interface NoteResponse {
  id: string
  title: string | null
  content: string | null
  note_type: string | null
  created: string
  updated: string
}

export interface SourceListResponse {
  id: string
  title: string | null
  topics?: string[]                  // Make optional to match Python API
  asset: {
    file_path?: string
    url?: string
  } | null
  embedded: boolean
  embedded_chunks: number            // ADD: From Python API
  insights_count: number
  created: string
  updated: string
  file_available?: boolean
  // ADD: Async processing fields from Python API
  command_id?: string
  status?: string
  processing_info?: Record<string, unknown>
}

export interface SourceDetailResponse extends SourceListResponse {
  full_text: string
  notebooks?: string[]  // List of notebook IDs this source is linked to
}

export type SourceResponse = SourceDetailResponse

export interface SourceStatusResponse {
  status?: string
  message: string
  processing_info?: Record<string, unknown>
  command_id?: string
}

export interface SettingsResponse {
  default_content_processing_engine_doc?: string
  default_content_processing_engine_url?: string
  default_embedding_option?: string
  auto_delete_files?: string
  youtube_preferred_languages?: string[]
}

export interface CreateNotebookRequest {
  name: string
  description?: string
}

export interface UpdateNotebookRequest {
  name?: string
  description?: string
  archived?: boolean
}

export interface CreateNoteRequest {
  title?: string
  content: string
  note_type?: string
  notebook_id?: string
}

export interface CreateSourceRequest {
  // Backward compatibility: support old single notebook_id
  notebook_id?: string
  // New multi-notebook support
  notebooks?: string[]
  // Required fields
  type: 'link' | 'upload' | 'text'
  url?: string
  file_path?: string
  content?: string
  title?: string
  transformations?: string[]
  embed?: boolean
  delete_source?: boolean
  // New async processing support
  async_processing?: boolean
}

export interface UpdateNoteRequest {
  title?: string
  content?: string
  note_type?: string
}

export interface UpdateSourceRequest {
  title?: string
  type?: 'link' | 'upload' | 'text'
  url?: string
  content?: string
}

export interface APIError {
  detail: string
}

// Source Chat Types
// Base session interface with common fields
export interface BaseChatSession {
  id: string
  title: string
  created: string
  updated: string
  message_count?: number
  model_override?: string | null
}

export interface SourceChatSession extends BaseChatSession {
  source_id: string
  model_override?: string
}

export interface SourceChatMessage {
  id: string
  type: 'human' | 'ai'
  content: string
  timestamp?: string
  citations?: ChatCitation[]
}

export interface SourceChatContextIndicator {
  sources: string[]
  insights: string[]
  notes: string[]
}

export interface SourceChatSessionWithMessages extends SourceChatSession {
  messages: SourceChatMessage[]
  context_indicators?: SourceChatContextIndicator
}

export interface CreateSourceChatSessionRequest {
  source_id: string
  title?: string
  model_override?: string
}

export interface UpdateSourceChatSessionRequest {
  title?: string
  model_override?: string
}

export interface SendMessageRequest {
  message: string
  model_override?: string
  systemPrompt?: string
}

export interface SourceChatStreamEvent {
  type: 'user_message' | 'ai_message' | 'context_indicators' | 'complete' | 'error'
  content?: string
  data?: unknown
  message?: string
  timestamp?: string
}

// Notebook Chat Types
export interface NotebookChatSession extends BaseChatSession {
  notebook_id: string
}

export interface NotebookChatMessage {
  id: string
  type: 'human' | 'ai'
  content: string
  timestamp?: string
  citations?: ChatCitation[]
}

export interface NotebookChatSessionWithMessages extends NotebookChatSession {
  messages: NotebookChatMessage[]
}

export interface CreateNotebookChatSessionRequest {
  notebook_id: string
  title?: string
  model_override?: string
}

export interface UpdateNotebookChatSessionRequest {
  title?: string
  model_override?: string | null
}

export interface SendNotebookChatMessageRequest {
  session_id: string
  message: string
  context: {
    sources: Array<Record<string, unknown>>
    notes: Array<Record<string, unknown>>
  }
  model_override?: string
}

export interface BuildContextRequest {
  notebook_id: string
  context_config: {
    sources: Record<string, string>
    notes: Record<string, string>
  }
}

export interface BuildContextResponse {
  context: {
    sources: Array<Record<string, unknown>>
    notes: Array<Record<string, unknown>>
  }
  token_count: number
  char_count: number
}

// ============================================================
// Context-OS Specific Types
// ============================================================

export interface KnowledgeBaseResponse {
  id: string
  user_id: string
  title: string
  icon: string | null
  description: string | null
  created_at: string
}

export interface DocumentResponse {
  id: string
  kb_id: string
  user_id: string
  file_name: string
  storage_path: string
  file_content: string | null
  mime_type: string | null
  file_size: number | null
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  ktype_summary: string | null
  ktype_metadata: string | null
  deep_summary: string | null
  chunk_count: number
  created_at: string
}

export interface KnowledgeBaseDetailResponse extends KnowledgeBaseResponse {
  documents: DocumentResponse[]
}

export interface CreateKnowledgeBaseRequest {
  title: string
  icon?: string
  description?: string
}

export interface KnowledgeBaseShareResponse {
  id: string
  kbId: string
  token: string
  url: string
  expiresAt: string | null
  accessCount?: number
  permissions: string
  revokedAt?: string | null
  createdAt: string
}

export interface KnowledgeBaseShareListResponse {
  shares: KnowledgeBaseShareResponse[]
}

export interface CreateKnowledgeBaseShareRequest {
  expiryDays?: number
  expiresAt?: string | null
  permissions?: string
}

export interface SharedLinkResponse {
  type: 'knowledge_base' | 'document'
  knowledgeBase?: {
    id: string
    title: string
    description: string | null
    createdAt: string
  }
  document?: {
    id: string
    title: string
    content: string | null
    ktypeSummary: string | null
    deepSummary: string | null
    createdAt: string
  }
  share: {
    permissions: string
    expiresAt: string | null
  }
}

export interface SharedKnowledgeBaseSourcesResponse {
  documents: DocumentResponse[]
}

export interface SharedKnowledgeBaseNotesResponse {
  notes: NoteResponse[]
}

export interface SharedKnowledgeBaseSourceIdsResponse {
  sourceIds: string[]
}

export interface UploadDocumentRequest {
  file: File
  kb_id: string
  autoProcess?: boolean
}

export interface DocumentUploadResponse {
  document: DocumentResponse
  documents: DocumentResponse[]
  autoProcessTriggered: boolean
  message: string
}

export interface DocumentStatusResponse {
  status: DocumentResponse['status']
  progress: number
}

export interface DocumentReprocessResponse {
  documentId: string
  status: string
}

export interface ChatSessionResponse {
  id: string
  kbId: string
  userId: string
  title: string
  summary: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateChatSessionRequest {
  kbId: string
  title?: string
}

export interface UpdateChatSessionRequest {
  title?: string
  summary?: string | null
}

export interface ChatCitation {
  index: number
  content: string
  docId: string
  docName: string
  chunkIndex?: number
  score?: number
  layer?: 'document' | 'parent' | 'child'
  metadata?: Record<string, unknown>
}

export interface ChatMessageResponse {
  id: number
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  citations?: ChatCitation[]
  createdAt: string
}

export interface ChatSessionDetailResponse {
  session: ChatSessionResponse
  messages: ChatMessageResponse[]
}

export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

// Context-OS API Response Wrapper
export interface ContextOSAPIResponse<T> {
  success: boolean
  data: T
  timestamp: string
}

export interface QuickNoteMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface QuickNoteListItem {
  id: string
  label: string
  preview: string
  createdAt: string
  updatedAt: string
}

export interface QuickNoteDetail {
  id: string
  label: string
  content: string
  fileName?: string
  createdAt: string
  updatedAt: string
}

export interface QuickNoteChatRequest {
  messages: QuickNoteMessage[]
  locale?: 'zh' | 'en'
}

export interface QuickNoteChatResponse {
  message: string
}

export interface QuickNoteLabelRequest {
  messages: QuickNoteMessage[]
  locale?: 'zh' | 'en'
}

export interface QuickNoteLabelResponse {
  label: string
}

export interface QuickNoteSaveRequest {
  messages: QuickNoteMessage[]
  label?: string
  locale?: 'zh' | 'en'
}
