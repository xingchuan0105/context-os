'use client'

/**
 * DocumentActions - 文档操作菜单组件
 */

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Eye, RefreshCw, Trash2, MoreVertical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Document } from '@/lib/api/types'
import { useDocumentActions } from '@/lib/stores/document-store'

interface DocumentActionsProps {
  doc: Document
  kbId: string
  onRefresh?: () => void
}

export function DocumentActions({ doc, kbId, onRefresh }: DocumentActionsProps) {
  const router = useRouter()
  const { deleteDocument, updateDocument } = useDocumentActions()

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${doc.file_name}"?`)) {
      try {
        await deleteDocument(doc.id)
        onRefresh?.()
      } catch (error) {
        console.error('Delete failed:', error)
      }
    }
  }

  const handleRetry = async () => {
    try {
      updateDocument(doc.id, { status: 'processing', error_message: null })
      // Trigger reprocessing via API
      await fetch(`/api/documents/${doc.id}/reprocess`, { method: 'POST' })
      onRefresh?.()
    } catch (error) {
      console.error('Retry failed:', error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => router.push(`/kb/${kbId}/doc/${doc.id}`)}
          disabled={doc.status !== 'completed'}
        >
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </DropdownMenuItem>

        {doc.status === 'failed' && (
          <DropdownMenuItem onClick={handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Processing
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
