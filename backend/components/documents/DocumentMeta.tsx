'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, HardDrive, FileText, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface DocumentMetaProps {
  document: {
    title: string
    file_size: number
    mime_type: string
    status: string
    chunk_count: number
    created_at: string
    updated_at: string
    ktype_summary?: string
  }
}

export function DocumentMeta({ document }: DocumentMetaProps) {
  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // 获取文件类型显示
  const getFileTypeDisplay = (mimeType: string) => {
    const typeMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
      'text/plain': 'Text',
      'text/markdown': 'Markdown',
    }
    return typeMap[mimeType] || mimeType
  }

  // 获取状态信息
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      completed: { text: '已完成', className: 'bg-green-100 text-green-800' },
      processing: { text: '处理中', className: 'bg-blue-100 text-blue-800' },
      failed: { text: '失败', className: 'bg-red-100 text-red-800' },
      queued: { text: '等待中', className: 'bg-yellow-100 text-yellow-800' },
    }
    return statusMap[status] || { text: status, className: 'bg-gray-100 text-gray-800' }
  }

  const statusInfo = getStatusInfo(document.status)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">文件类型</p>
              <p className="text-sm font-medium">{getFileTypeDisplay(document.mime_type)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">文件大小</p>
              <p className="text-sm font-medium">{formatFileSize(document.file_size)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">创建时间</p>
              <p className="text-sm font-medium">
                {formatDistanceToNow(new Date(document.created_at), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">状态</p>
              <Badge className={`mt-0.5 ${statusInfo.className}`}>{statusInfo.text}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
