'use client'

import Link from 'next/link'
import { AdminLiteLLMModelCenter } from '@/components/admin/AdminLiteLLMModelCenter'
import { AdminPortalShell } from '@/components/admin/AdminPortalShell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAdminMe } from '@/lib/hooks/use-admin-auth'

export default function AdminModelsPage() {
  const adminMeQuery = useAdminMe()
  const admin = adminMeQuery.data

  if (!admin) {
    return null
  }

  if (admin.role !== 'super_admin') {
    return (
      <AdminPortalShell active="reports">
        <Alert variant="destructive">
          <AlertTitle>无权限访问</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>模型管理页面仅超级管理员可访问。</span>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/reports">返回报表页</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </AdminPortalShell>
    )
  }

  return (
    <AdminPortalShell active="models">
      <AdminLiteLLMModelCenter />
    </AdminPortalShell>
  )
}
