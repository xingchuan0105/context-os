'use client'

/**
 * Knowledge Base Detail Page (Refactored)
 *
 * 拆分为多个子组件，提升可维护性
 */

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Notice } from '@/components/ui/notice'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useKBStore, useKnowledgeBases, useCurrentKB, useKBActions } from '@/lib/stores/kb-store'
import { useDocuments, useDocumentActions } from '@/lib/stores/document-store'
import { documentsApi } from '@/lib/api/documents'
import { knowledgeBaseApi } from '@/lib/api/knowledge-base'
import { EmptyState, LoadingState } from '@/components/ui/state'
import { DocumentCard } from '@/components/documents/DocumentCard'
import { DocumentStats } from '@/components/documents/DocumentStats'
import { Search, Upload, ArrowLeft, File, Loader2 } from 'lucide-react'

function UploadDialog({
  kbId,
  onUpload,
}: {
  kbId: string
  onUpload: (file: File) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files?.length > 0) {
      await handleFileUpload(files[0])
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await handleFileUpload(files[0])
    }
  }

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    setError(null)
    try {
      await onUpload(file)
      setOpen(false)
    } catch (error: unknown) {
      console.error('Upload failed:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : 'Upload failed. Please try again.'
      setError(errorMessage)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen)
        if (newOpen) setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload PDF, DOCX, or text files for AI-powered analysis and indexing.
          </DialogDescription>
        </DialogHeader>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInput}
            accept=".pdf,.docx,.doc,.txt,.md"
            className="hidden"
            id="file-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center cursor-pointer"
          >
            <File className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              {isUploading ? 'Uploading...' : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports PDF, DOCX, TXT, MD up to 50MB
            </p>
          </label>
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function KnowledgeBaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const kbId = params.id as string

  // Use selectors
  const documents = useDocuments()
  const { setDocuments, updateDocument, setError, setLoading } = useDocumentActions()
  const knowledgeBases = useKnowledgeBases()
  const kb = useCurrentKB()
  const { setCurrentKB } = useKBActions()

  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (kbId) {
      fetchKB()
      fetchDocuments()
    }
  }, [kbId])

  const fetchKB = async () => {
    try {
      const data = await knowledgeBaseApi.getById(kbId)
      setCurrentKB(data)
    } catch (error) {
      console.error('Failed to fetch KB:', error)
      router.push('/')
    }
  }

  const fetchDocuments = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await documentsApi.getByKBId(kbId)
      setDocuments(data)
    } catch (error) {
      console.error('Failed to fetch documents:', error)
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const result = await documentsApi.upload(kbId, file, true)

      // Poll for status if processing started
      if (result.document.status === 'processing') {
        pollDocumentStatus(result.document.id)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  const pollDocumentStatus = async (docId: string) => {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0

    const poll = async () => {
      if (attempts >= maxAttempts) return

      try {
        const status = await documentsApi.getStatus(docId)
        if (status.status === 'completed' || status.status === 'failed') {
          fetchDocuments()
          return
        }

        attempts++
        setTimeout(poll, 5000)
      } catch (error) {
        console.error('Polling failed:', error)
      }
    }

    poll()
  }

  const filteredDocs = (documents || []).filter((doc) =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const processingDocs = (documents || []).filter((doc) =>
    doc.status === 'processing' || doc.status === 'pending' || doc.status === 'queued'
  )
  const failedDocs = (documents || []).filter((doc) => doc.status === 'failed')

  if (!kb) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <LoadingState
            title="知识库加载中..."
            description="正在获取数据，请稍候"
            className="max-w-sm w-full"
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              {kb.title}
            </h1>
            {kb.description && (
              <p className="text-muted-foreground mt-1">{kb.description}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <DocumentStats documents={documents} className="mb-6" />

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <UploadDialog kbId={kbId} onUpload={handleUpload} />
        </div>

        {processingDocs.length > 0 && (
          <Notice className="mb-4">
            {processingDocs.length} document(s) are processing. Status updates will appear automatically.
          </Notice>
        )}

        {failedDocs.length > 0 && (
          <Notice variant="error" className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span>{failedDocs.length} document(s) failed.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  failedDocs.forEach((doc) => {
                    updateDocument(doc.id, { status: 'processing', error_message: null })
                    fetch(`/api/documents/${doc.id}/reprocess`, { method: 'POST' })
                  })
                }}
              >
                Retry All
              </Button>
            </div>
          </Notice>
        )}

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Upload and manage your documents. AI processing happens automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDocs.length === 0 ? (
              <EmptyState
                title={searchQuery ? '没有匹配的文档' : '还没有文档'}
                description={
                  searchQuery
                    ? '调整搜索条件或检查文件名。'
                    : '上传文档后即可进行分析与问答。'
                }
                className="py-10"
                icon={File}
              />
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredDocs.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      kbId={kbId}
                      onRefresh={fetchDocuments}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
