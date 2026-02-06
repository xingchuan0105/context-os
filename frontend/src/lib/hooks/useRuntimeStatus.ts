'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getConfig, resetConfig } from '@/lib/config'

type DbStatus = 'online' | 'offline' | 'unknown'

interface RuntimeStatusState {
  online: boolean
  backendReachable: boolean
  dbStatus: DbStatus
  version?: string
  hasUpdate?: boolean
  lastChecked?: string
  error?: string
  isChecking: boolean
}

const DEFAULT_STATE: RuntimeStatusState = {
  online: true,
  backendReachable: true,
  dbStatus: 'unknown',
  isChecking: true,
}

export function useRuntimeStatus(options?: { intervalMs?: number }) {
  const [state, setState] = useState<RuntimeStatusState>(DEFAULT_STATE)
  const intervalMs = options?.intervalMs ?? 30000
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    const online =
      typeof navigator === 'undefined' ? true : navigator.onLine

    if (!mountedRef.current) return
    setState((prev) => ({
      ...prev,
      online,
      isChecking: true,
      error: undefined,
    }))

    if (!online) {
      if (!mountedRef.current) return
      setState({
        online,
        backendReachable: false,
        dbStatus: 'unknown',
        lastChecked: new Date().toISOString(),
        error: 'offline',
        isChecking: false,
      })
      return
    }

    try {
      resetConfig()
      const config = await getConfig()
      if (!mountedRef.current) return
      setState({
        online,
        backendReachable: !!config.backendReachable,
        dbStatus: config.dbStatus ?? 'unknown',
        version: config.version,
        hasUpdate: config.hasUpdate,
        lastChecked: new Date().toISOString(),
        error: undefined,
        isChecking: false,
      })
    } catch (err: unknown) {
      if (!mountedRef.current) return
      setState({
        online,
        backendReachable: false,
        dbStatus: 'unknown',
        lastChecked: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'unknown_error',
        isChecking: false,
      })
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    const interval = setInterval(refresh, intervalMs)
    const handleOnline = () => refresh()
    const handleOffline = () => refresh()

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    return () => {
      mountedRef.current = false
      clearInterval(interval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [intervalMs, refresh])

  return {
    ...state,
    refresh,
  }
}
