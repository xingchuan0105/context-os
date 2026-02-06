'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { documentsApi } from '@/lib/api/documents'
import type { Document as DocumentRecord } from '@/lib/api/types'
import { ArrowLeft, FileText, Loader2 } from 'lucide-react'

function formatFileSize(bytes?: number | null) {
  if (bytes === null || bytes === undefined) return 'N/A'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString()
}

function formatMetadata(raw?: string | null) {
  if (!raw) return null
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export default function DocumentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const kbId = params.id as string
  const docId = params.docId as string

  const [document, setDocument] = useState<DocumentRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)

  const fetchDoc = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${docId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load document')
      }
      const data = (await res.json()) as DocumentRecord
      if (cancelledRef.current) return
      setDocument(data)
      if (data.status === 'processing' || data.status === 'queued' || data.status === 'pending') {
        timerRef.current = setTimeout(fetchDoc, 5000)
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load document')
      }
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false)
      }
    }
  }, [docId])

  useEffect(() => {
    cancelledRef.current = false
    if (docId) {
      void fetchDoc()
    }

    return () => {
      cancelledRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [docId, fetchDoc])

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/kb/${kbId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {document?.file_name || 'Document'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {document ? formatFileSize(document.file_size) : ''}
              {document?.mime_type ? ` · ${document.mime_type}` : ''}
            </p>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {document && (
          <>
            {document.status === 'failed' && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader>
                  <CardTitle>Processing Failed</CardTitle>
                  <CardDescription>
                    Retry processing to regenerate summaries and embeddings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-destructive">
                  {document.error_message || 'No failure details available.'}
                </CardContent>
                <CardContent className="pt-0">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isRetrying}
                    onClick={async () => {
                      if (!document) return
                      setIsRetrying(true)
                      setError(null)
                      try {
                        await documentsApi.retryProcessing(document.id)
                        setDocument({ ...document, status: 'processing', error_message: null })
                        void fetchDoc()
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to retry document')
                      } finally {
                        setIsRetrying(false)
                      }
                    }}
                  >
                    {isRetrying ? 'Retrying...' : 'Retry Processing'}
                  </Button>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Status</CardDescription>
                  <CardTitle className="text-lg capitalize flex items-center gap-2">
                    {(document.status === 'processing' || document.status === 'queued') && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {document.status}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Created</CardDescription>
                  <CardTitle className="text-sm">{formatDate(document.created_at)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Chunks</CardDescription>
                  <CardTitle className="text-lg">{document.chunk_count ?? 0}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>K-Type Summary</CardTitle>
                <CardDescription>Executive summary</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="whitespace-pre-wrap">
                    {document.ktype_summary || 'No summary available yet.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deep Summary</CardTitle>
                <CardDescription>Expanded report for this document</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px] rounded-md border bg-muted/20 p-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {document.deep_summary || 'Report not available yet.'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>K-Type Metadata</CardTitle>
                <CardDescription>Structured metadata output</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[240px] rounded-md border bg-muted/20 p-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {formatMetadata(document.ktype_metadata) || 'Metadata not available yet.'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}
