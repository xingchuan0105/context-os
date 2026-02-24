'use client'

import { useEffect } from 'react'
import { AxiosError } from 'axios'
import { usePathname, useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAdminMe } from '@/lib/hooks/use-admin-auth'

function isUnauthorized(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined
    return data?.error?.message || data?.message || '加载管理员会话失败'
  }

  if (error instanceof Error) {
    return error.message
  }

  return '加载管理员会话失败'
}

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const adminMeQuery = useAdminMe()

  useEffect(() => {
    if (!adminMeQuery.error) {
      return
    }

    if (isUnauthorized(adminMeQuery.error)) {
      const next = encodeURIComponent(pathname || '/admin')
      router.replace(`/admin/login?next=${next}`)
    }
  }, [adminMeQuery.error, pathname, router])

  if (adminMeQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (adminMeQuery.error && !isUnauthorized(adminMeQuery.error)) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>管理后台加载失败</AlertTitle>
          <AlertDescription>{getErrorMessage(adminMeQuery.error)}</AlertDescription>
        </Alert>
      </main>
    )
  }

  if (!adminMeQuery.data) {
    return null
  }

  return <ErrorBoundary>{children}</ErrorBoundary>
}
