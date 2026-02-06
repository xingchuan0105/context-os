'use client'

/**
 * 可折叠区域组件
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title?: string
  defaultExpanded?: boolean
  children: React.ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
  className,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className={cn('flex flex-col', className)}>
      {title && (
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center justify-between px-2 h-8 text-sm font-medium text-muted-foreground hover:bg-muted/50"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>{title}</span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      )}
      {isExpanded && <div className="flex-1 overflow-auto">{children}</div>}
    </div>
  )
}
