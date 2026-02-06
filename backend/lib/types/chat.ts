/**
 * Chat 相关类型定义
 */

/**
 * 聊天会话
 */
export interface ChatSession {
  id: string
  kbId: string
  userId: string
  title: string // 自动生成或用户编辑
  summary?: string // AI 生成的会话摘要
  createdAt: string
  updatedAt: string
}

/**
 * 聊天消息角色
 */
export type ChatMessageRole = 'user' | 'assistant' | 'system'

/**
 * 引用层类型
 */
export type CitationLayer = 'document' | 'parent' | 'child'

/**
 * 引用信息
 */
export interface Citation {
  index: number
  content: string
  docId: string
  docName: string
  chunkIndex?: number
  score?: number
  /** 引用所属层级 */
  layer?: CitationLayer
  metadata?: Record<string, unknown>
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: number
  sessionId: string
  role: ChatMessageRole
  content: string
  citations?: Citation[]
  createdAt: string
}

/**
 * 创建会话请求
 */
export interface CreateSessionRequest {
  kbId: string
  title?: string
}

/**
 * 发送消息请求
 */
export interface SendMessageRequest {
  message: string
  selectedSourceIds?: string[]
  systemPrompt?: string
}

/**
 * 搜索结果项（流式响应中使用）
 */
export interface SearchResultItem {
  docId: string
  docName: string
  content: string
  score: number
  chunkIndex?: number
  layer?: CitationLayer
}

/**
 * 流式消息事件
 */
export type StreamMessageEvent =
  | { type: 'start'; data?: { timestamp: number } }
  | { type: 'user'; data: { content: string } }
  | { type: 'search'; data: { count: number; results?: SearchResultItem[] } }
  | { type: 'token'; data: { content: string } }
  | { type: 'citation'; data: { index: number; citation: Citation } }
  | { type: 'done'; data: { content: string; citations: Citation[] } }
  | { type: 'error'; data: { message: string } }

/**
 * 聊天状态
 */
export interface ChatState {
  // 当前会话
  currentSession: ChatSession | null
  messages: ChatMessage[]

  // 会话列表
  sessions: ChatSession[]

  // 加载状态
  isLoading: boolean
  isStreaming: boolean
  error: string | null
}
