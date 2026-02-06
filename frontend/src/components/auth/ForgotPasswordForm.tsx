'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useI18n } from '@/lib/i18n'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || t('auth.resetRequestFailed'))
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetRequestFailedRetry'))
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>{t('auth.emailSentTitle')}</CardTitle>
            <CardDescription>
              {t('auth.emailSentDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>{t('auth.checkInbox')}</p>
              <p className="mt-2">{t('auth.resetLinkExpiry')}</p>
            </div>

            <Button
              onClick={() => router.push('/login')}
              className="w-full"
              variant="outline"
            >
              {t('auth.backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <CardTitle>{t('auth.forgotTitle')}</CardTitle>
          </div>
          <CardDescription>
            {t('auth.forgotDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm text-muted-foreground mb-2 block">
                {t('auth.forgotEmailLabel')}
              </label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholderExample')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                data-testid="forgot-email"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email.trim()}
              data-testid="forgot-submit"
            >
              {isLoading ? <LoadingSpinner /> : t('auth.sendReset')}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              {t('auth.rememberPassword')}{' '}
              <Link href="/login" className="text-primary hover:underline">
                {t('auth.backToLogin')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
