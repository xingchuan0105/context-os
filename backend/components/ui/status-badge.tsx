import type { HTMLAttributes } from 'react'
import { Badge } from './badge'
import { cn } from '@/lib/utils'
import type { DocumentStatus } from '@/lib/api/types'
import { CheckCircle2, Clock, Loader2, AlertCircle, XCircle } from 'lucide-react'

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  queued: { label: '排队中', icon: Clock, className: 'bg-slate-100 text-slate-700' },
  pending: { label: '等待中', icon: Clock, className: 'bg-amber-100 text-amber-700' },
  processing: {
    label: '处理中',
    icon: Loader2,
    className: 'bg-blue-100 text-blue-700',
  },
  completed: {
    label: '已完成',
    icon: CheckCircle2,
    className: 'bg-emerald-100 text-emerald-700',
  },
  failed: { label: '失败', icon: XCircle, className: 'bg-rose-100 text-rose-700' },
}

export function StatusBadge({
  status,
  className,
  ...rest
}: { status: DocumentStatus } & HTMLAttributes<HTMLDivElement>) {
  const config = STATUS_CONFIG[status] || {
    label: '未知',
    icon: AlertCircle,
    className: 'bg-muted text-foreground',
  }
  const Icon = config.icon

  return (
    <Badge
      variant="secondary"
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        config.className,
        className
      )}
      {...rest}
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'processing' ? 'animate-spin' : '')} />
      <span className="capitalize">{config.label}</span>
    </Badge>
  )
}
