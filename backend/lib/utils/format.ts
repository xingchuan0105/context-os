/**
 * Format utility functions
 *
 * Shared formatting functions for consistent display across the application
 */

/**
 * Format file size in human-readable format
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "500 KB")
 *
 * @example
 * formatFileSize(1536000) // "1.5 MB"
 * formatFileSize(500) // "500 B"
 * formatFileSize(null) // "N/A"
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return 'N/A'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * Format date in localized format
 *
 * @param dateString - ISO date string
 * @returns Formatted date string
 *
 * @example
 * formatDate("2024-01-15T10:30:00Z") // "Jan 15, 2024"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format date with time
 *
 * @param dateString - ISO date string
 * @returns Formatted date and time string
 *
 * @example
 * formatDateTime("2024-01-15T10:30:00Z") // "Jan 15, 2024, 10:30 AM"
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Format relative time (e.g., "2 hours ago")
 *
 * @param dateString - ISO date string
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime("2024-01-15T10:30:00Z") // "2 hours ago" (depending on current time)
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

  return formatDate(dateString)
}

/**
 * Format number with thousands separator
 *
 * @param num - Number to format
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1000000) // "1,000,000"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Format percentage
 *
 * @param value - Value between 0 and 1
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(0.8547) // "85.5%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return (value * 100).toFixed(decimals) + '%'
}
