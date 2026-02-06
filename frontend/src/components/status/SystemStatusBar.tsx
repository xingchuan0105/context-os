'use client'

import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRuntimeStatus } from '@/lib/hooks/useRuntimeStatus'

type Tone = 'ok' | 'warn' | 'error' | 'neutral'

const toneClass: Record<Tone, string> = {
  ok: 'bg-emerald-500/80',
  warn: 'bg-amber-500/80',
  error: 'bg-rose-500/80',
  neutral: 'bg-muted-foreground/60',
}

const formatTime = (iso?: string) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SystemStatusBar() {
  const {
    online,
    backendReachable,
    dbStatus,
    lastChecked,
    isChecking,
    refresh,
  } = useRuntimeStatus()

  const backendTone: Tone = backendReachable ? 'ok' : 'error'
  const dbTone: Tone =
    dbStatus === 'online' ? 'ok' : dbStatus === 'offline' ? 'warn' : 'neutral'
  const networkTone: Tone = online ? 'ok' : 'error'

  const timestamp = formatTime(lastChecked)

  const items = useMemo(
    () => [
      {
        label: 'Network',
        value: online ? 'Online' : 'Offline',
        tone: networkTone,
      },
      {
        label: 'Backend',
        value: backendReachable ? 'Reachable' : 'Unreachable',
        tone: backendTone,
      },
      {
        label: 'Database',
        value:
          dbStatus === 'online'
            ? 'Online'
            : dbStatus === 'offline'
              ? 'Offline'
              : 'Unknown',
        tone: dbTone,
      },
    ],
    [online, backendReachable, dbStatus, networkTone, backendTone, dbTone]
  )

  const showRetry = !online || !backendReachable || dbStatus === 'offline'

  return (
    <div className="border-b border-border/60 bg-background/80">
      <div className="px-4 py-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${toneClass[item.tone]}`}
                aria-hidden
              />
              <span className="font-medium text-foreground/80">
                {item.label}
              </span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {timestamp && (
            <span className="text-[11px] text-muted-foreground/80">
              Updated {timestamp}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={refresh}
            disabled={isChecking}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isChecking ? 'animate-spin' : ''}`} />
            {showRetry ? 'Retry' : 'Refresh'}
          </Button>
        </div>
      </div>
    </div>
  )
}
