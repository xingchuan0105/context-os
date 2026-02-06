'use client'

/**
 * 文件源清单组件
 * 支持勾选、取消勾选、删除
 */

import { useEffect, useState } from 'react'
import { FileText, Plus, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDocumentSourceStore } from '@/lib/stores/document-source-store'
import { cn } from '@/lib/utils'

interface Document {
  id: string
  file_name: string
  status: string
}

interface DocumentSourceListProps {
  kbId: string
  className?: string
}

export function DocumentSourceList({ kbId, className }: DocumentSourceListProps) {
  const { selectedSourceIds, toggleSource, isSelected, setSelectedIds } =
    useDocumentSourceStore()
  const [documents, setDocuments] = useState<Document[]>([])

  // 加载文档列表
  useEffect(() => {
    fetchDocuments()
  }, [kbId])

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/documents?kb_id=${kbId}`)
      const data = await res.json()
      if (data.documents) {
        setDocuments(data.documents)
        const docs = data.documents || []
        const completedIds = docs
          .filter((doc: Document) => doc.status === 'completed')
          .map((doc: Document) => doc.id)
        if (selectedSourceIds.size > 0) {
          const nextSelected = Array.from(selectedSourceIds).filter((id) =>
            completedIds.includes(id)
          )
          if (nextSelected.length !== selectedSourceIds.size) {
            setSelectedIds(nextSelected)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
  }

  const handleToggle = (docId: string) => {
    toggleSource(docId)
  }

  const completedDocs = (documents || []).filter((doc) => doc.status === 'completed')
  const selectedCount = completedDocs.filter((doc) => selectedSourceIds.has(doc.id)).length

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">
          文件源 {selectedCount > 0 && `(${selectedCount}/${completedDocs.length})`}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1 h-[200px]">
        <div className="space-y-1 px-1">
          {documents.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              暂无文档
            </div>
          ) : completedDocs.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              暂无可用文档
            </div>
          ) : (
            completedDocs.map((doc) => {
              const isChecked = isSelected(doc.id)
              return (
                <div
                  key={doc.id}
                  className={cn(
                    'group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    isChecked
                      ? 'bg-blue-50/50 dark:bg-blue-950/20'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <Checkbox
                    id={`doc-${doc.id}`}
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(doc.id)}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor={`doc-${doc.id}`}
                    className="flex-1 flex items-center gap-2 cursor-pointer truncate"
                  >
                    <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.file_name}</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* 提示信息 */}
      {selectedCount === 0 && completedDocs.length > 0 && (
        <div className="text-xs text-muted-foreground text-center py-2 px-2">
          勾选文档以在对话中使用
        </div>
      )}
    </div>
  )
}
