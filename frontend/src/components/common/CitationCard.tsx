'use client'

import { FileText, FileEdit, Lightbulb } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface CitationData {
  id: number
  docId: string
  docName: string
  layer: string
  content: string
}

interface CitationCardProps {
  citation: CitationData
  visible: boolean
}

export function CitationCard({ citation, visible }: CitationCardProps) {
  if (!visible) return null

  const LayerIcon =
    citation.layer === 'document' ? FileText :
    citation.layer === 'parent' ? FileEdit :
    Lightbulb

  const layerLabel =
    citation.layer === 'document' ? '文档' :
    citation.layer === 'parent' ? '章节' :
    '细节'

  return (
    <Card className="border shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            [{citation.id}]
          </Badge>
          <span className="text-xs text-muted-foreground">
            {citation.docName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
          <LayerIcon className="h-3 w-3" />
          <span>{layerLabel}</span>
        </div>

        <ScrollArea className="max-h-40 max-w-full">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {citation.content}
          </p>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
