'use client'

/**
 * DocumentCard - 单个文档卡片组件
 *
 * 使用 React.memo 优化性能，避免不必要的重渲染
 */

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { File } from 'lucide-react'
import { DocumentActions } from './DocumentActions'
import { DocumentStatusIcon } from './DocumentStatusIcon'
import type { Document } from '@/lib/api/types'
import { formatFileSize, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface DocumentCardProps {
  doc: Document
  kbId: string
  onRefresh?: () => void
  className?: string
}

export const DocumentCard = React.memo<DocumentCardProps>(
  ({ doc, kbId, onRefresh, className }) => {
    return (
      <div
        className={cn(
          'flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group',
          className
        )}
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <File className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{doc.file_name}</p>
            <DocumentStatusIcon status={doc.status} />
            <span className="text-xs text-muted-foreground capitalize">
              {doc.status}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatFileSize(doc.file_size)}</span>
            <span>•</span>
            <span>{formatDate(doc.created_at)}</span>
            {doc.chunk_count !== null && (
              <>
                <span>•</span>
                <span>{doc.chunk_count} chunks</span>
              </>
            )}
          </div>

          {doc.status === 'failed' && doc.error_message && (
            <div className="mt-1 text-xs text-destructive line-clamp-2">
              {doc.error_message}
            </div>
          )}
        </div>

        <DocumentActions doc={doc} kbId={kbId} onRefresh={onRefresh} />
      </div>
    )
  },
  (prevProps, nextProps) => {
    // 只在这些字段变化时才重新渲染
    return (
      prevProps.doc.id === nextProps.doc.id &&
      prevProps.doc.status === nextProps.doc.status &&
      prevProps.doc.file_name === nextProps.doc.file_name &&
      prevProps.doc.error_message === nextProps.doc.error_message
    )
  }
)

DocumentCard.displayName = 'DocumentCard'
