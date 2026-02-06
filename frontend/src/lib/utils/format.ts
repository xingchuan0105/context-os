/**
 * 格式化数字工具函数
 */

/**
 * 格式化数字，使用 K (千) 或 M (百万) 后缀
 * @param num 要格式化的数字
 * @returns 格式化后的字符串
 * @example
 * formatNumber(500) // "500"
 * formatNumber(1500) // "1.5K"
 * formatNumber(1500000) // "1.5M"
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 * @example
 * formatBytes(500) // "500 B"
 * formatBytes(1500) // "1.5 KB"
 * formatBytes(1500000) // "1.5 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
