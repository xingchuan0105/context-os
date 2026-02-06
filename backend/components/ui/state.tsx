import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2, Inbox, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'muted' | 'error'

interface StateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
  tone?: Tone
}

function StateCard({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = 'muted',
}: StateProps) {
  const toneClasses: Record<Tone, string> = {
    muted: 'border-border/70 bg-muted/40 text-foreground',
    error: 'border-destructive/50 bg-destructive/5 text-foreground',
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-6 text-center space-y-2',
        toneClasses[tone],
        className
      )}
    >
      {Icon && <Icon className="h-8 w-8 mx-auto text-muted-foreground" />}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2 flex justify-center">{action}</div>}
    </div>
  )
}

export function LoadingState({
  title = '加载中...',
  description,
  className,
}: Omit<StateProps, 'tone' | 'icon'>) {
  return (
    <StateCard
      title={title}
      description={description}
      className={cn('space-y-3', className)}
      icon={Loader2}
    />
  )
}

export function EmptyState({
  title = '暂无数据',
  description,
  action,
  className,
  icon = Inbox,
}: StateProps) {
  return (
    <StateCard
      icon={icon}
      title={title}
      description={description}
      action={action}
      className={className}
      tone="muted"
    />
  )
}

export function ErrorState({
  title = '出错了',
  description,
  action,
  className,
  icon = AlertTriangle,
}: StateProps) {
  return (
    <StateCard
      icon={icon}
      title={title}
      description={description}
      action={action}
      className={className}
      tone="error"
    />
  )
}
