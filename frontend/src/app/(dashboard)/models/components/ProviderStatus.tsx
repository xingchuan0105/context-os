'use client'

import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, X } from 'lucide-react'
import { ProviderAvailability } from '@/lib/types/models'
import { useI18n } from '@/lib/i18n'

interface ProviderStatusProps {
  providers: ProviderAvailability
}

export function ProviderStatus({ providers }: ProviderStatusProps) {
  const { t } = useI18n()
  // Combine all providers, with available ones first
  const allProviders = useMemo(
    () => [
      ...providers.available.map((p) => ({ name: p, available: true })),
      ...providers.unavailable.map((p) => ({ name: p, available: false })),
    ],
    [providers.available, providers.unavailable],
  )

  const [expanded, setExpanded] = useState(false)

  const visibleProviders = useMemo(() => {
    if (expanded) {
      return allProviders
    }
    return allProviders.slice(0, 6)
  }, [allProviders, expanded])

  const getModelTypeLabel = (type: string) => {
    switch (type) {
      case 'language':
        return t('models.type.language')
      case 'embedding':
        return t('models.type.embedding')
      case 'text_to_speech':
        return t('models.type.textToSpeech')
      case 'speech_to_text':
        return t('models.type.speechToText')
      default:
        return type.replace('_', ' ')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('models.providers.title')}</CardTitle>
        <CardDescription>
          {t('models.providers.description')}
          <span className="ml-1">
            {t('models.providers.configuredCount', {
              configured: providers.available.length,
              total: allProviders.length
            })}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleProviders.map((provider) => {
            const supportedTypes = providers.supported_types[provider.name] ?? []

            return (
              <div
                key={provider.name}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  provider.available ? 'bg-card' : 'bg-muted/40'
                }`}
              >
                <div className={`flex items-center justify-center rounded-full p-1.5 ${
                  provider.available
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'bg-muted-foreground/10 text-muted-foreground'
                }`}>
                  {provider.available ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span
                    className={`truncate text-sm font-medium capitalize ${
                      !provider.available ? 'text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {provider.name}
                  </span>

                  {provider.available ? (
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {supportedTypes.length > 0 ? (
                        supportedTypes.map((type) => (
                          <Badge key={type} variant="secondary" className="text-xs font-medium">
                            {getModelTypeLabel(type)}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {t('models.providers.noModels')}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
                      {t('models.providers.notConfigured')}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {allProviders.length > 6 ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="text-sm font-medium text-primary hover:underline"
            >
              {expanded
                ? t('models.providers.seeLess')
                : t('models.providers.seeAll', { count: allProviders.length })}
            </button>
          </div>
        ) : null}

        <div className="mt-6 pt-4 border-t">
          <a
            href="https://contextlm.top"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {t('models.providers.learnMore')}
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
