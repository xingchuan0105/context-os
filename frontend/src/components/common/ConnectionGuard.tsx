'use client'

import { useEffect, useState, useCallback } from 'react'
import { ConnectionError } from '@/lib/types/config'
import { ConnectionErrorOverlay } from '@/components/errors/ConnectionErrorOverlay'
import { getConfig, resetConfig } from '@/lib/config'
import { USE_MOCK_DATA } from '@/lib/mock/flags'
import { useI18n } from '@/lib/i18n'

interface ConnectionGuardProps {
  children: React.ReactNode
}

export function ConnectionGuard({ children }: ConnectionGuardProps) {
  const [error, setError] = useState<ConnectionError | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const { t } = useI18n()

  const checkConnection = useCallback(async () => {
    if (USE_MOCK_DATA) {
      setError(null)
      setIsChecking(false)
      return
    }

    setIsChecking(true)
    setError(null)

    // Reset config cache to force a fresh fetch
    resetConfig()

    try {
      const config = await getConfig()

      if (config.backendReachable === false) {
        setError({
          type: 'api-unreachable',
          details: {
            message: t('connection.apiDesc'),
            attemptedUrl: config.apiUrl ? `${config.apiUrl}/config` : undefined,
          },
        })
        setIsChecking(false)
        return
      }

      // Check if database is offline
      if (config.dbStatus === 'offline') {
        setError({
          type: 'database-offline',
          details: {
            message: t('connection.dbDesc'),
            attemptedUrl: config.apiUrl,
          },
        })
        setIsChecking(false)
        return
      }

      // If we got here, connection is good
      setError(null)
      setIsChecking(false)
    } catch (err) {
      // API is unreachable
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred'
      const attemptedUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/config`
          : undefined

      setError({
        type: 'api-unreachable',
        details: {
          message: t('connection.apiDesc'),
          technicalMessage: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
          attemptedUrl,
        },
      })
      setIsChecking(false)
    }
  }, [])

  // Check connection on mount
  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  // Add keyboard shortcut for retry (R key)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (error && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        checkConnection()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [error, checkConnection])

  // Show overlay if there's an error
  if (error) {
    return <ConnectionErrorOverlay error={error} onRetry={checkConnection} />
  }

  // Show nothing while checking (prevents flash of content)
  if (isChecking) {
    return null
  }

  // Render children if connection is good
  return <>{children}</>
}
