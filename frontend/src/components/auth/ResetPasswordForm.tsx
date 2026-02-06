'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useI18n } from '@/lib/i18n'

function ResetPasswordFormContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError(t('auth.resetTokenMissing'))
      return
    }

    // Verify token
    const verifyToken = async () => {
      try {
        const response = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        const data = await response.json()
        if (data.data?.valid) {
          setTokenValid(true)
          setEmail(data.data.email || '')
        } else {
          setTokenValid(false)
          setError(data.data?.message || t('auth.resetTokenInvalid'))
        }
      } catch (err) {
        setTokenValid(false)
        setError(t('auth.resetVerifyFailed'))
      }
    }

    verifyToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (!/[a-z]/.test(password)) {
      setError(t('auth.passwordNeedLower'))
      return
    }
    if (!/[A-Z]/.test(password)) {
      setError(t('auth.passwordNeedUpper'))
      return
    }
    if (!/\d/.test(password)) {
      setError(t('auth.passwordNeedNumber'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || t('auth.resetFailed'))
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetFailedRetry'))
    } finally {
      setIsLoading(false)
    }
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <LoadingSpinner />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <CardTitle>{t('auth.resetInvalidTitle')}</CardTitle>
            </div>
            <CardDescription>
              {error || t('auth.resetInvalidDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => router.push('/forgot-password')}
              className="w-full"
              variant="outline"
            >
              {t('auth.requestNewLink')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>{t('auth.resetSuccessTitle')}</CardTitle>
            <CardDescription>
              {t('auth.resetSuccessDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.redirectingToLogin')}
            </p>
            <Button
              onClick={() => router.push('/login')}
              className="w-full"
            >
              {t('auth.loginNow')}
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
            <CardTitle>{t('auth.resetTitle')}</CardTitle>
          </div>
          <CardDescription>
            {t('auth.resetForEmail', {
              email: email ? `${email.substring(0, 3)}***@${email.split('@')[1]}` : ''
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="text-sm text-muted-foreground mb-2 block">
                {t('auth.newPasswordLabel')}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.newPasswordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                  data-testid="reset-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-sm text-muted-foreground mb-2 block">
                {t('auth.confirmPasswordLabel')}
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                  data-testid="reset-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              disabled={isLoading || !password || !confirmPassword}
              data-testid="reset-submit"
            >
              {isLoading ? <LoadingSpinner /> : t('auth.resetPasswordButton')}
            </Button>

            <div className="text-xs text-muted-foreground">
              {t('auth.passwordRules')}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <LoadingSpinner />
      </div>
    }>
      <ResetPasswordFormContent />
    </Suspense>
  )
}
