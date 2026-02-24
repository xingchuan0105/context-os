'use client'

import { AdminMetricsDashboard } from '@/components/admin/AdminMetricsDashboard'
import { AdminPortalShell } from '@/components/admin/AdminPortalShell'

export default function AdminReportsPage() {
  return (
    <AdminPortalShell active="reports">
      <AdminMetricsDashboard />
    </AdminPortalShell>
  )
}
