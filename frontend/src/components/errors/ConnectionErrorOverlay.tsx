'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Database, Server, ChevronDown, ExternalLink } from 'lucide-react'
import { ConnectionError } from '@/lib/types/config'
import { useI18n } from '@/lib/i18n'

interface ConnectionErrorOverlayProps {
  error: ConnectionError
  onRetry: () => void
}

export function ConnectionErrorOverlay({
  error,
  onRetry,
}: ConnectionErrorOverlayProps) {
  const [showDetails, setShowDetails] = useState(false)
  const isApiError = error.type === 'api-unreachable'
  const { t } = useI18n()

  return (
    <div
      className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <Card className="max-w-2xl w-full p-8 space-y-6">
        {/* Error icon and title */}
        <div className="flex items-center gap-4">
          {isApiError ? (
            <Server className="w-12 h-12 text-destructive" aria-hidden="true" />
          ) : (
            <Database className="w-12 h-12 text-destructive" aria-hidden="true" />
          )}
          <div>
            <h1 className="text-2xl font-bold" id="error-title">
              {isApiError
                ? t('connection.apiTitle')
                : t('connection.dbTitle')}
            </h1>
            <p className="text-muted-foreground">
              {isApiError
                ? t('connection.apiDesc')
                : t('connection.dbDesc')}
            </p>
          </div>
        </div>

        {/* Troubleshooting instructions */}
        <div className="space-y-4 border-l-4 border-primary pl-4">
          <h2 className="font-semibold">{t('connection.usuallyMeans')}</h2>
          <ul className="list-disc list-inside space-y-2 text-sm">
            {isApiError ? (
              <>
                <li>{t('connection.apiReason1')}</li>
                <li>{t('connection.apiReason2')}</li>
                <li>{t('connection.apiReason3')}</li>
              </>
            ) : (
              <>
                <li>{t('connection.dbReason1')}</li>
                <li>{t('connection.dbReason2')}</li>
                <li>{t('connection.dbReason3')}</li>
              </>
            )}
          </ul>

          <h2 className="font-semibold mt-4">{t('connection.quickFixes')}</h2>
          {isApiError ? (
            <div className="space-y-2 text-sm bg-muted p-4 rounded">
              <p className="font-medium">{t('connection.apiFixTitle')}</p>
              <code className="block bg-background p-2 rounded text-xs">
                {t('connection.apiFixEnv')}
                <br />
                NEXT_PUBLIC_API_URL=http://localhost:3002
                <br />
                <br />
                {t('connection.apiFixBackend')}
                <br />
                npm run dev
              </code>
            </div>
          ) : (
            <div className="space-y-2 text-sm bg-muted p-4 rounded">
              <p className="font-medium">{t('connection.dbFixTitle')}</p>
              <code className="block bg-background p-2 rounded text-xs">
                {t('connection.dbFixEnv')}
                <br />
                DATABASE_URL=./data/context-os.db
                <br />
                <br />
                {t('connection.dbFixFile')}
              </code>
            </div>
          )}
        </div>

        {/* Documentation link */}
        <div className="text-sm">
          <p>{t('connection.docsIntro')}</p>
          <a
            href="https://contextlm.top"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            {t('connection.docsTitle')}
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Collapsible technical details */}
        {error.details && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>{t('connection.showDetails')}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showDetails ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-2 text-sm bg-muted p-4 rounded font-mono">
                {error.details.attemptedUrl && (
                  <div>
                    <strong>{t('connection.attemptedUrl')}</strong> {error.details.attemptedUrl}
                  </div>
                )}
                {error.details.message && (
                  <div>
                    <strong>{t('connection.message')}</strong> {error.details.message}
                  </div>
                )}
                {error.details.technicalMessage && (
                  <div>
                    <strong>{t('connection.technicalDetails')}</strong>{' '}
                    {error.details.technicalMessage}
                  </div>
                )}
                {error.details.stack && (
                  <div>
                    <strong>{t('connection.stackTrace')}</strong>
                    <pre className="mt-2 overflow-x-auto text-xs">
                      {error.details.stack}
                    </pre>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Retry button */}
        <div className="pt-4 border-t">
          <Button onClick={onRetry} className="w-full" size="lg">
            {t('connection.retry')}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            {t('connection.retryHint')}
          </p>
        </div>
      </Card>
    </div>
  )
}
