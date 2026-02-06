'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type NoticeVariant = 'info' | 'warning' | 'error'

const variantStyles: Record<NoticeVariant, string> = {
  info: 'border-border/60 bg-muted/30 text-muted-foreground',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700',
  error: 'border-destructive/40 bg-destructive/5 text-destructive',
}

interface NoticeProps {
  variant?: NoticeVariant
  title?: string
  className?: string
  children: ReactNode
}

export function Notice({
  variant = 'info',
  title,
  className,
  children,
}: NoticeProps) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        variantStyles[variant],
        className
      )}
    >
      {title && <div className="mb-1 font-medium">{title}</div>}
      <div>{children}</div>
    </div>
  )
}
