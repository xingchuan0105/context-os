'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAdminMe } from '@/lib/hooks/use-admin-auth'

export default function AdminPage() {
  const router = useRouter()
  const adminMeQuery = useAdminMe()

  useEffect(() => {
    const admin = adminMeQuery.data
    if (!admin) {
      return
    }

    if (admin.role === 'super_admin') {
      router.replace('/admin/capabilities')
      return
    }

    router.replace('/admin/reports')
  }, [adminMeQuery.data, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner />
    </div>
  )
}
