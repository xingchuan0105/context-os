'use client'

/**
 * DocumentStatusIcon - 文档状态图标组件
 */

import { Loader2, RefreshCw, File } from 'lucide-react'

interface DocumentStatusIconProps {
  status: string
}

export function DocumentStatusIcon({ status }: DocumentStatusIconProps) {
  switch (status) {
    case 'processing':
    case 'pending':
    case 'queued':
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
    case 'completed':
      return <RefreshCw className="h-4 w-4 text-green-600" />
    case 'failed':
      return <RefreshCw className="h-4 w-4 text-red-600" />
    default:
      return <File className="h-4 w-4 text-gray-400" />
  }
}
