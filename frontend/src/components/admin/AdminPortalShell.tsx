'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAdminLogout, useAdminMe } from '@/lib/hooks/use-admin-auth'
import { BarChart3, Home, LogOut, Settings2, ShieldCheck, UserCog, Workflow } from 'lucide-react'

type AdminNavKey = 'reports' | 'capabilities' | 'models'

type AdminPortalShellProps = {
  active: AdminNavKey
  children: ReactNode
}

const NAV_ITEMS: Array<{
  key: AdminNavKey
  href: string
  label: string
  superAdminOnly: boolean
  icon: typeof BarChart3
}> = [
  {
    key: 'reports',
    href: '/admin/reports',
    label: '数据报表',
    superAdminOnly: false,
    icon: BarChart3,
  },
  {
    key: 'capabilities',
    href: '/admin/capabilities',
    label: '能力路由',
    superAdminOnly: true,
    icon: Workflow,
  },
  {
    key: 'models',
    href: '/admin/models',
    label: '模型管理',
    superAdminOnly: true,
    icon: Settings2,
  },
]

export function AdminPortalShell({ active, children }: AdminPortalShellProps) {
  const router = useRouter()
  const adminMeQuery = useAdminMe()
  const logoutMutation = useAdminLogout()

  const admin = adminMeQuery.data
  const isSuperAdmin = admin?.role === 'super_admin'

  const handleLogout = async () => {
    await logoutMutation.mutateAsync()
    router.replace('/admin/login')
  }

  if (!admin) {
    return null
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1400px] p-6 md:p-8 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <ShieldCheck className="h-3 w-3" />
              独立管理后台
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Portal</h1>
            <p className="text-sm text-muted-foreground max-w-3xl">
              独立于用户端，仅管理员可访问。用于运营报表查看、能力路由配置与 LiteLLM 模型资产管理。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">/admin</Badge>
            <Badge variant={isSuperAdmin ? 'default' : 'secondary'}>
              <UserCog className="h-3 w-3 mr-1" />
              {isSuperAdmin ? '超级管理员' : '报表管理员'}
            </Badge>
            <Badge variant="outline">{admin.email}</Badge>
            <Button asChild variant="outline">
              <Link href="/notebooks">
                <Home className="h-4 w-4 mr-2" />
                返回用户端
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending}>
              <LogOut className="h-4 w-4 mr-2" />
              {logoutMutation.isPending ? '退出中...' : '退出后台'}
            </Button>
          </div>
        </header>

        {!isSuperAdmin ? (
          <Alert>
            <AlertTitle>当前为报表管理员</AlertTitle>
            <AlertDescription>你只能查看报表，不能访问能力路由和模型管理。</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin).map((item) => {
            const Icon = item.icon

            return (
              <Button key={item.key} asChild variant={item.key === active ? 'default' : 'outline'} size="sm">
                <Link href={item.href}>
                  <Icon className="h-4 w-4 mr-1" />
                  {item.label}
                </Link>
              </Button>
            )
          })}
        </div>

        {children}
      </div>
    </main>
  )
}
