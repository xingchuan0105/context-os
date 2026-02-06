// Context OS 核心类型定义

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  usage_tpm: number
  created_at: string
}

export interface KnowledgeBase {
  id: string
  user_id: string
  title: string
  icon: string | null
  description: string | null
  created_at: string
}

export interface Document {
  id: string
  kb_id: string
  user_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  file_size: number | null
  status: DocumentStatus
  error_message: string | null
  deep_summary: DeepSummary | null
  knowledge_graph: KnowledgeGraph | null
  created_at: string
}

export type DocumentStatus = 'uploading' | 'queued' | 'processing' | 'completed' | 'failed'

export interface DeepSummary {
  score: number
  k_type: string
  insights: string[]
  summary: string
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphNode {
  id: string
  label: string
  type: string
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
}

export interface DocumentChunk {
  id: number
  doc_id: string
  content: string
  metadata: ChunkMetadata | null
  embedding: number[] | null
}

export interface ChunkMetadata {
  page?: number
  chunk_index?: number
}

export interface ChatSession {
  id: string
  kb_id: string | null
  user_id: string
  title: string | null
  created_at: string
}

export interface ChatMessage {
  id: number
  session_id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[] | null
  created_at: string
}

export interface Citation {
  doc_id: string
  page?: number
  file_name?: string
}

export interface Note {
  id: string
  kb_id: string | null
  user_id: string
  content: string
  is_shared: boolean
  share_token: string | null
  updated_at: string
}

// API 请求/响应类型
export interface IngestRequest {
  storage_path: string
  kb_id: string
  file_name: string
  mime_type?: string
  file_size?: number
}

export interface IngestResponse {
  task_id: string
  doc_id: string
  status: DocumentStatus
}

export interface ChatRequest {
  message: string
  session_id?: string
  kb_id?: string
  doc_ids?: string[]
}

// 任务队列类型
export interface IngestJobData {
  doc_id: string
  user_id: string
  storage_path: string
  kb_id: string
}

export interface JobProgress {
  stage: 'downloading' | 'parsing' | 'scanning' | 'extracting' | 'embedding' | 'completed'
  message: string
  progress?: number
}
