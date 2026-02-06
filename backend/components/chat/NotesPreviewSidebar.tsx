'use client'

/**
 * NotesPreviewSidebar - 笔记预览侧边栏
 */

import { useState } from 'react'
import { Plus, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface Note {
  id: string
  content: string
  updated_at: string
}

interface NotesPreviewSidebarProps {
  kbId: string
  className?: string
}

export function NotesPreviewSidebar({
  kbId,
  className,
}: NotesPreviewSidebarProps) {
  const [notes, setNotes] = useState<Note[]>([])

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm font-medium">笔记</span>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {notes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无笔记</p>
              <p className="text-xs mt-1">从对话中保存想法...</p>
            </div>
          ) : (
            notes.map((note) => (
              <Card key={note.id} className="p-3">
                <p className="text-sm line-clamp-4">{note.content}</p>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
