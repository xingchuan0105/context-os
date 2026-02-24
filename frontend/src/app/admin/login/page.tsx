'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAdminLogin, useAdminMe } from '@/lib/hooks/use-admin-auth'
import { Lock, ShieldCheck } from 'lucide-react'

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined

    const statusCode = error.response?.status
    if (!statusCode) {
      return '无法连接管理服务，请确认 3002/3003 服务正常后重试'
    }

    if (statusCode >= 500) {
      return `管理服务暂时不可用（HTTP ${statusCode}），请稍后重试`
    }

    return data?.error?.message || data?.message || '登录失败，请稍后重试'
  }

  if (error instanceof Error) {
    return error.message
  }

  return '登录失败，请稍后重试'
}

export default function AdminLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const adminMeQuery = useAdminMe()
  const loginMutation = useAdminLogin()

  const [email, setEmail] = useState('xingchuan0105@163.com')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const nextPath = useMemo(() => {
    const next = searchParams.get('next')
    if (!next || !next.startsWith('/')) {
      return '/admin'
    }
    return next
  }, [searchParams])

  useEffect(() => {
    if (adminMeQuery.data) {
      router.replace(nextPath)
    }
  }, [adminMeQuery.data, nextPath, router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password.trim()) {
      setErrorMessage('请输入管理员邮箱和密码')
      return
    }

    setErrorMessage(null)

    try {
      await loginMutation.mutateAsync({
        email: trimmedEmail,
        password,
      })
      router.replace(nextPath)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  if (adminMeQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Admin Login
            </Badge>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">管理后台登录</CardTitle>
            <CardDescription>
              独立于用户端登录，仅管理员可访问 `/admin`。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium">管理员邮箱</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">管理员密码</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="请输入管理员密码"
              />
            </div>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>登录失败</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" />
                  登录中...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  进入管理后台
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
