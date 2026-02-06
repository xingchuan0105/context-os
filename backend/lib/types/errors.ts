/**
 * 错误类型定义
 *
 * 提供统一的错误类型和类型守卫函数
 */

/**
 * SQLite 数据库错误
 */
export interface SQLiteError extends Error {
  code?: string
  errno?: number
}

/**
 * API 错误
 */
export interface APIError extends Error {
  code?: string
  status?: number
  response?: {
    data?: {
      error?: string
      message?: string
    }
  }
}

/**
 * 网络错误
 */
export interface NetworkError extends Error {
  statusCode?: number
  statusText?: string
}

/**
 * 类型守卫：检查是否为 SQLite 错误
 */
export function isSQLiteError(error: unknown): error is SQLiteError {
  return (
    error instanceof Error &&
    ('code' in error || 'errno' in error)
  )
}

/**
 * 类型守卫：检查是否为 API 错误
 */
export function isAPIError(error: unknown): error is APIError {
  return (
    error instanceof Error &&
    ('code' in error || 'status' in error || 'response' in error)
  )
}

/**
 * 类型守卫：检查是否为网络错误
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return (
    error instanceof Error &&
    ('statusCode' in error || 'statusText' in error)
  )
}

/**
 * 获取错误消息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

/**
 * 检查错误是否为特定类型
 */
export function isDuplicateColumnError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('duplicate column')
  }
  return false
}
