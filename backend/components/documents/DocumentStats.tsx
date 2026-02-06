'use client'

/**
 * DocumentStats - 文档统计卡片组件
 */

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Document } from '@/lib/api/types'

interface DocumentStatsProps {
  documents: Document[]
  className?: string
}

export function DocumentStats({ documents, className }: DocumentStatsProps) {
  const docs = documents || []
  const totalCount = docs.length
  const processingCount = docs.filter((d) => d.status === 'processing').length
  const completedCount = docs.filter((d) => d.status === 'completed').length
  const failedCount = docs.filter((d) => d.status === 'failed').length

  return (
    <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${className}`}>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Documents</CardDescription>
          <CardTitle className="text-2xl">{totalCount}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Processing</CardDescription>
          <CardTitle className="text-2xl">{processingCount}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Completed</CardDescription>
          <CardTitle className="text-2xl">{completedCount}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Failed</CardDescription>
          <CardTitle className="text-2xl">{failedCount}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
