/**
 * API Utilities
 *
 * Helper functions for API operations
 */

import type { Document, KnowledgeBase, ChatSession } from '../types'

// ==================== Validation Utilities ====================

/**
 * Validate required fields in an object
 */
export function validateRequired<T extends Record<string, unknown>>(
  obj: T,
  requiredFields: (keyof T)[]
): void {
  const missing = requiredFields.filter((field) => !obj[field])
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`)
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
}

// ==================== Data Transformation Utilities ====================

/**
 * Convert file size in bytes to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Convert date to relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const past = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - past.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`
  return past.toLocaleDateString()
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - suffix.length) + suffix
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Check if file type is supported for document upload
 */
export function isSupportedFileType(fileType: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
  ]
  const supportedExtensions = ['pdf', 'doc', 'docx', 'txt', 'md', 'csv']

  if (supportedTypes.includes(fileType)) return true
  const ext = fileType.startsWith('.') ? fileType.substring(1).toLowerCase() : fileType.toLowerCase()
  return supportedExtensions.includes(ext)
}

// ==================== Entity Utilities ====================

/**
 * Generic sort by date function
 */
export function sortByDate<T extends { created_at: string }>(
  items: T[],
  order: 'asc' | 'desc' = 'desc'
): T[] {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime()
    const dateB = new Date(b.created_at).getTime()
    return order === 'asc' ? dateA - dateB : dateB - dateA
  })
}

/**
 * Generic sort by string field
 */
export function sortByString<T extends object>(
  items: T[],
  field: keyof T,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const comparison = String(a[field] || '').localeCompare(String(b[field] || ''))
    return order === 'asc' ? comparison : -comparison
  })
}

/**
 * Sort documents by date (backwards compatible)
 */
export const sortDocumentsByDate = (documents: Document[], order: 'asc' | 'desc' = 'desc') =>
  sortByDate(documents, order)

/**
 * Sort documents by name (backwards compatible)
 */
export const sortDocumentsByName = (documents: Document[], order: 'asc' | 'desc' = 'asc') =>
  sortByString(documents, 'file_name', order)

/**
 * Sort knowledge bases by date (backwards compatible)
 */
export const sortKnowledgeBasesByDate = (kbs: KnowledgeBase[], order: 'asc' | 'desc' = 'desc') =>
  sortByDate(kbs, order)

/**
 * Sort chat sessions by updated date (backwards compatible)
 */
export const sortChatSessionsByDate = (sessions: ChatSession[], order: 'asc' | 'desc' = 'desc') =>
  sortByDate(sessions, order)

/**
 * Generic filter by status
 */
export function filterByStatus<T extends { status: string }>(
  items: T[],
  status: string
): T[] {
  return items.filter((item) => item.status === status)
}

/**
 * Generic filter by search term
 */
export function filterBySearch<T extends { file_name?: string; name?: string }>(
  items: T[],
  searchTerm: string
): T[] {
  const term = searchTerm.toLowerCase()
  return items.filter((item) => {
    const name = item.file_name || item.name || ''
    return name.toLowerCase().includes(term)
  })
}

/**
 * Filter documents by status (backwards compatible)
 */
export const filterDocumentsByStatus = (documents: Document[], status: Document['status']) =>
  filterByStatus(documents, status)

/**
 * Filter documents by search (backwards compatible)
 */
export const filterDocumentsBySearch = (documents: Document[], searchTerm: string) =>
  filterBySearch(documents, searchTerm)

// ==================== Pagination Utilities ====================

/**
 * Paginate an array
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  items: T[]
  totalPages: number
  totalItems: number
  currentPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
} {
  const totalItems = items.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const currentPage = Math.max(1, Math.min(page, totalPages))
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    items: items.slice(startIndex, endIndex),
    totalPages,
    totalItems,
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  }
}

/**
 * Calculate pagination info
 */
export function calculatePaginationInfo(total: number, page: number, pageSize: number): {
  totalPages: number
  currentPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  startIndex: number
  endIndex: number
} {
  const totalPages = Math.ceil(total / pageSize)
  const currentPage = Math.max(1, Math.min(page, totalPages))
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, total)

  return {
    totalPages,
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    startIndex,
    endIndex,
  }
}

// ==================== Error Handling Utilities ====================

/**
 * Extract error message from unknown error
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'An unknown error occurred'
}

/**
 * Check error by code
 */
function isErrorCode(error: unknown, code: string): boolean {
  return !!(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === code
  )
}

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: unknown) => isErrorCode(error, 'NETWORK_ERROR')

/**
 * Check if error is a timeout error
 */
export const isTimeoutError = (error: unknown) => isErrorCode(error, 'TIMEOUT_ERROR')

/**
 * Check if error is a validation error
 */
export const isValidationError = (error: unknown) => isErrorCode(error, 'VALIDATION_ERROR')

/**
 * Check if error is an authentication error
 */
export const isAuthError = (error: unknown) =>
  isErrorCode(error, 'UNAUTHORIZED') || isErrorCode(error, 'FORBIDDEN')
