'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { useNotebook } from '@/lib/hooks/use-notebooks'
import { useNotes, useCreateNote, useUpdateNote } from '@/lib/hooks/use-notes'
import { useSources, useCreateSource, useDeleteSource, useRetrySource, useSourceStatus } from '@/lib/hooks/use-sources'
import { useNotebookChatV2 } from '@/lib/hooks/useNotebookChatV2'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { ContextSelections } from '@/lib/types/common'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CitationCard, type CitationData } from '@/components/common/CitationCard'
import { convertBracketCitations } from '@/lib/utils/source-references'
import { stripAssistantMeta } from '@/lib/utils/assistant-output'
import { useMockStore } from '@/lib/mock/store'
import { USE_MOCK_DATA } from '@/lib/mock/flags'
import quickNotesApi from '@/lib/api/quick-notes'
import { QUERY_KEYS } from '@/lib/api/query-client'
import type { QuickNoteListItem, SourceListResponse } from '@/lib/types/api'
import {
  ArrowLeft,
  ArrowUpRight,
  Clipboard,
  Copy,
  FileText,
  FileUp,
  Globe,
  Link2,
  Loader2,
  MessageSquare,
  PenLine,
  RefreshCw,
  Sparkles,
  StickyNote,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  AlertTriangle,
} from 'lucide-react'
import { AddExistingSourceDialog } from '@/components/sources/AddExistingSourceDialog'

const statusTone: Record<string, string> = {
  queued: 'bg-amber-100 text-amber-700',
  new: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
}

const columnMin = {
  sources: 280,
  chat: 360,
  notes: 280,
}

type Translate = ReturnType<typeof useI18n>['t']

const normalizeStatus = (status?: string) => {
  if (!status) return 'completed'
  if (status === 'new') return 'queued'
  if (status === 'running') return 'processing'
  if (status === 'queued' || status === 'processing' || status === 'completed' || status === 'failed') {
    return status
  }
  return 'completed'
}

const getProgress = (status?: string) => {
  const normalized = normalizeStatus(status)
  if (normalized === 'queued') return 20
  if (normalized === 'processing') return 60
  if (normalized === 'failed') return 100
  return 100
}

const getStatusDetailKey = (status?: string) => {
  return normalizeStatus(status)
}

interface NotebookSourceRowProps {
  source: SourceListResponse
  isSelected: boolean
  onToggle: () => void
  onDelete: () => void
  onRetry: () => void
  onOpen: () => void
  deleteDisabled: boolean
  retryDisabled: boolean
  t: Translate
}

function NotebookSourceRow({
  source,
  isSelected,
  onToggle,
  onDelete,
  onRetry,
  onOpen,
  deleteDisabled,
  retryDisabled,
  t,
}: NotebookSourceRowProps) {
  const sourceWithStatus = source as SourceListResponse & { command_id?: string; status?: string }
  const initialStatus = normalizeStatus(
    sourceWithStatus.status || (sourceWithStatus.command_id ? 'new' : 'completed')
  )
  const shouldFetchStatus =
    !!sourceWithStatus.command_id ||
    (initialStatus !== 'completed' && initialStatus !== 'failed')

  const { data: statusData } = useSourceStatus(source.id, shouldFetchStatus)

  const rawStatus = statusData?.status || sourceWithStatus.status
  const status = normalizeStatus(rawStatus)
  const statusDetailKey = getStatusDetailKey(rawStatus)

  const typeLabel = source.asset?.url
    ? t('upload.website')
    : source.asset?.file_path
      ? t('upload.file')
      : t('upload.paste')

  const metaLabel = source.asset?.url || source.asset?.file_path || '-'
  const canRead = status === 'completed'

  const rawProgress = statusData?.processing_info?.progress
  const parsedProgress =
    typeof rawProgress === 'number'
      ? rawProgress
      : typeof rawProgress === 'string'
        ? Number.parseFloat(rawProgress)
        : undefined
  const progressValue = Number.isFinite(parsedProgress)
    ? Math.min(Math.max(parsedProgress as number, 0), 100)
    : getProgress(rawStatus)

  const detailText = statusData?.message || t(`status.detail.${statusDetailKey}` as 'status.detail.queued')

  return (
    <div
      onClick={() => {
        if (canRead) {
          onOpen()
        }
      }}
      className={`rounded-xl border border-border/60 bg-background/70 p-2.5 space-y-2 ${
        canRead ? 'cursor-pointer hover:border-primary/40 hover:bg-background/80' : ''
      } ${isSelected ? 'border-primary/40 bg-primary/5' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{source.title || t('label.title')}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{metaLabel}</span>
                <span className="text-[10px] uppercase tracking-wide">{typeLabel}</span>
              </div>
              {status !== 'completed' && (
                <p className={`text-xs mt-1 ${status === 'failed' ? 'text-rose-600' : 'text-muted-foreground'}`}>
                  {detailText}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusTone[status]}`}>
                {t(`status.${status}` as 'status.completed')}
              </span>
              <div onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onToggle}
                  className="mt-0.5"
                  data-testid={`source-toggle-${source.id}`}
                />
              </div>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted mt-2">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {status === 'failed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onRetry()
              }}
              disabled={retryDisabled}
              className="h-6 px-2 text-[11px] text-rose-600 hover:text-rose-700"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${retryDisabled ? 'animate-spin' : ''}`} />
              {t('action.retry')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            disabled={deleteDisabled}
              aria-label={t('source.delete')}
            className="h-6 w-6 text-muted-foreground hover:text-rose-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Message content component with citation rendering
function MessageContent({
  content,
  citations
}: {
  content: string
  citations?: Array<{
    index: number
    content: string
    docId: string
    docName: string
    chunkIndex?: number
    score?: number
    layer?: string
  }>
}) {
  // Build citation map
  const citationMap = useMemo(() => {
    const map = new Map<number, CitationData>()
    if (citations) {
      for (const citation of citations) {
        map.set(citation.index, {
          id: citation.index,
          docId: citation.docId,
          docName: citation.docName,
          layer: (citation.layer as 'document' | 'parent' | 'child') || 'child',
          content: citation.content
        })
      }
    }
    return map
  }, [citations])

  // Convert [[ID]] format to markdown links
  const processedContent = useMemo(() => {
    return convertBracketCitations(stripAssistantMeta(content))
  }, [content])

  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            // Check if this is a citation link
            const citationMatch = href?.match(/^#ref-citation-(\d+)$/)
            if (citationMatch) {
              const citationId = parseInt(citationMatch[1], 10)
              const citation = citationMap.get(citationId)
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs h-5 px-1.5 hover:bg-accent cursor-pointer"
                    >
                      {children}
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0 max-w-md w-auto z-50 max-h-[280px] overflow-y-auto bg-popover border border-border shadow-lg"
                    align="start"
                    sideOffset={4}
                  >
                    {citation ? (
                      <CitationCard citation={citation} visible={true} />
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground">
                        闁诲孩顔栭崰妤€煤濠婂牆鏋?[{citationId}] 闂備浇妗ㄩ懗鑸垫櫠濡も偓閻ｅ灚绗熼埀顒€顕ｉ悽鍓叉晜闁告侗鍙庡Λ鐔兼⒑?
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )
            }
            // Regular link
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {children}
              </a>
            )
          },
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}

export default function NotebookDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { setCollapsed } = useSidebarStore()

  const kbId = decodeURIComponent(params.id as string)
  const { data: notebook, isLoading: notebookLoading } = useNotebook(kbId)
  const { data: kbSources = [], isLoading: sourcesLoading } = useSources(kbId)
  const { data: kbNotes = [], isLoading: notesLoading } = useNotes(kbId)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const createSource = useCreateSource()
  const deleteSource = useDeleteSource()
  const retrySource = useRetrySource()
  const queryClient = useQueryClient()
  const { openModal } = useModalManager()
  const mockQuickNotes = useMockStore((state) => state.quickNotes)
  const [quickNoteList, setQuickNoteList] = useState<QuickNoteListItem[]>([])
  const [quickNoteLoading, setQuickNoteLoading] = useState(false)
  const [showChatErrorDetails, setShowChatErrorDetails] = useState(false)

  const quickNotes = useMemo(
    () =>
      USE_MOCK_DATA
        ? mockQuickNotes.map((note) => ({
            id: note.id,
            label: note.label,
            preview: note.preview,
          }))
        : quickNoteList.map((note) => ({
            id: note.id,
            label: note.label,
            preview: note.preview,
          })),
    [mockQuickNotes, quickNoteList]
  )

  const [excludedSourceIds, setExcludedSourceIds] = useState<string[]>([])
  const selectedSources = useMemo(
    () => kbSources.filter((source) => !excludedSourceIds.includes(source.id)),
    [excludedSourceIds, kbSources]
  )

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'url' | 'paste' | 'quickNote'>('file')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadUrl, setUploadUrl] = useState('')
  const [uploadText, setUploadText] = useState('')
  const [uploadQuickNoteId, setUploadQuickNoteId] = useState<string | null>(null)
  const [addExistingOpen, setAddExistingOpen] = useState(false)

  const [noteContent, setNoteContent] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down' | null>>({})
  const [convertingNoteId, setConvertingNoteId] = useState<string | null>(null)
  const convertingNoteIdsRef = useRef<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null)
  const [clearChatDialogOpen, setClearChatDialogOpen] = useState(false)

  const [columnSizes, setColumnSizes] = useState({
    sources: 340,
    chat: 520,
    notes: 360,
  })
  const [containerWidth, setContainerWidth] = useState(0)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<{
    edge: 'sources' | 'notes'
    startX: number
    startSizes: typeof columnSizes
  } | null>(null)

  useEffect(() => {
    setCollapsed(true)
    return () => {
      setCollapsed(false)
    }
  }, [setCollapsed])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (event: PointerEvent) => {
      const delta = event.clientX - dragging.startX
      if (dragging.edge === 'sources') {
        const total = dragging.startSizes.sources + dragging.startSizes.chat
        const nextSources = Math.min(
          Math.max(dragging.startSizes.sources + delta, columnMin.sources),
          total - columnMin.chat
        )
        setColumnSizes((prev) => ({
          ...prev,
          sources: nextSources,
          chat: total - nextSources,
        }))
      } else {
        const total = dragging.startSizes.chat + dragging.startSizes.notes
        const nextChat = Math.min(
          Math.max(dragging.startSizes.chat + delta, columnMin.chat),
          total - columnMin.notes
        )
        setColumnSizes((prev) => ({
          ...prev,
          chat: nextChat,
          notes: total - nextChat,
        }))
      }
    }
    const handleUp = () => {
      setDragging(null)
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragging])

  useEffect(() => {
    if (USE_MOCK_DATA || !uploadOpen) {
      return
    }
    let active = true
    setQuickNoteLoading(true)
    quickNotesApi
      .list()
      .then((data) => {
        if (active) setQuickNoteList(data)
      })
      .catch((error) => {
        console.error('Failed to load quick notes:', error)
      })
      .finally(() => {
        if (active) setQuickNoteLoading(false)
      })

    return () => {
      active = false
    }
  }, [uploadOpen])

  useEffect(() => {
    const container = gridContainerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const selectedNote = useMemo(
    () => kbNotes.find((note) => note.id === selectedNoteId) ?? null,
    [kbNotes, selectedNoteId]
  )

  const contextSelections = useMemo<ContextSelections>(() => {
    const sourcesSelection = kbSources.reduce<Record<string, 'off' | 'insights' | 'full'>>(
      (acc, source) => {
        acc[source.id] = excludedSourceIds.includes(source.id) ? 'off' : 'insights'
        return acc
      },
      {}
    )
    const notesSelection = kbNotes.reduce<Record<string, 'off' | 'insights' | 'full'>>(
      (acc, note) => {
        acc[note.id] = 'off'
        return acc
      },
      {}
    )
    return {
      sources: sourcesSelection,
      notes: notesSelection,
    }
  }, [excludedSourceIds, kbSources, kbNotes])

  const {
    messages,
    isSending,
    streamStatus,
    streamPhase,
    sendMessage,
    deleteSession,
    currentSessionId,
    lastError,
    resetSession,
    clearError,
    refetchSessions,
    retryLastMessage,
  } = useNotebookChatV2({
    notebookId: kbId,
    sources: kbSources,
    notes: kbNotes,
    contextSelections,
    locale,
  })

  useEffect(() => {
    if (!lastError) {
      setShowChatErrorDetails(false)
    }
  }, [lastError])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const gutterWidth = 16
  const baseTotal = columnSizes.sources + columnSizes.chat + columnSizes.notes
  const availableWidth = Math.max(containerWidth - gutterWidth, 0)
  const extraWidth = baseTotal > 0 && availableWidth > baseTotal ? availableWidth - baseTotal : 0
  const extraSources = baseTotal > 0 ? Math.floor(extraWidth * (columnSizes.sources / baseTotal)) : 0
  const extraNotes = baseTotal > 0 ? Math.floor(extraWidth * (columnSizes.notes / baseTotal)) : 0
  const extraChat = extraWidth - extraSources - extraNotes
  const effectiveColumns = {
    sources: columnSizes.sources + extraSources,
    chat: columnSizes.chat + extraChat,
    notes: columnSizes.notes + extraNotes,
  }

  const handleUpload = () => {
    if (uploadMode === 'file') {
      if (!uploadFile) return
      createSource.mutate({
        notebook_id: kbId,
        type: 'upload',
        title: uploadFile.name,
        async_processing: true,
        file: uploadFile,
      })
    }
    if (uploadMode === 'url') {
      if (!uploadUrl.trim()) return
      const label = uploadUrl.replace(/^https?:\/\//, '').slice(0, 48)
      createSource.mutate({
        notebook_id: kbId,
        type: 'link',
        url: uploadUrl.trim(),
          title: label || t('source.websiteTitle'),
        async_processing: true,
      })
    }
    if (uploadMode === 'paste') {
      if (!uploadText.trim()) return
      const label = uploadText.trim().split('\n')[0]?.slice(0, 32) || 'Pasted Text'
      createSource.mutate({
        notebook_id: kbId,
        type: 'text',
        content: uploadText.trim(),
        title: label,
        async_processing: true,
      })
    }
    if (uploadMode === 'quickNote') {
      if (!uploadQuickNoteId) return
      const note = quickNotes.find((entry) => entry.id === uploadQuickNoteId)
      if (!note) return
      if (USE_MOCK_DATA) {
        if (!note.preview) return
        createSource.mutate({
          notebook_id: kbId,
          type: 'text',
          content: note.preview,
          title: note.label,
          async_processing: true,
        })
      } else {
        quickNotesApi
          .promote(note.id, kbId)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sources(kbId) })
          })
          .catch((error) => {
            console.error('Quick note promote failed:', error)
          })
      }
    }
    setUploadOpen(false)
    setUploadFile(null)
    setUploadFileName('')
    setUploadUrl('')
    setUploadText('')
    setUploadQuickNoteId(null)
  }

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return
    if (!selectedNote) {
      try {
        const note = await createNote.mutateAsync({
          notebook_id: kbId,
          content: noteContent.trim(),
          note_type: 'human',
        })
        setSelectedNoteId(note.id)
      } catch (error) {
        console.error('Failed to create note:', error)
      }
      return
    }

    try {
      await updateNote.mutateAsync({
        id: selectedNote.id,
        data: {
          content: noteContent.trim() || selectedNote.content || undefined,
        },
      })
    } catch (error) {
      console.error('Failed to update note:', error)
    }
  }

  const handleConvertNote = async () => {
    if (!selectedNote) return
    if (!selectedNote.content) return
    if (convertingNoteIdsRef.current.has(selectedNote.id)) return
    convertingNoteIdsRef.current.add(selectedNote.id)
    setConvertingNoteId(selectedNote.id)
    try {
      const sourceTitle =
        selectedNote.content?.trim().split('\n')[0]?.slice(0, 48) || t('label.title')
      await createSource.mutateAsync({
        notebook_id: kbId,
        type: 'text',
        title: sourceTitle,
        content: selectedNote.content,
        async_processing: true,
      })
      await updateNote.mutateAsync({
        id: selectedNote.id,
        data: { note_type: 'source' },
      })
    } catch (error) {
      console.error('Failed to convert note:', error)
    } finally {
      convertingNoteIdsRef.current.delete(selectedNote.id)
      setConvertingNoteId((prev) => (prev === selectedNote.id ? null : prev))
    }
  }

  const handleNewNote = () => {
    setSelectedNoteId(null)
    setNoteContent('')
  }

  const handleSendMessage = () => {
    if (!chatInput.trim()) return
    sendMessage(chatInput.trim())
    setChatInput('')
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSaveAnswer = async (content: string) => {
    try {
      await createNote.mutateAsync({
        notebook_id: kbId,
        content,
        note_type: 'ai',
      })
    } catch (error) {
      console.error('Failed to save answer:', error)
    }
  }

  const toggleSource = (sourceId: string) => {
    setExcludedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    )
  }

  const handleCopy = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(messageId)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (error) {
      console.error(error)
    }
  }

  const toggleFeedback = (messageId: string, value: 'up' | 'down') => {
    setFeedback((prev) => {
      const current = prev[messageId]
      if (current === value) {
        return { ...prev, [messageId]: null }
      }
      return { ...prev, [messageId]: value }
    })
  }

  const handleDeleteSource = (sourceId: string) => {
    setSourceToDelete(sourceId)
    setDeleteDialogOpen(true)
  }

  const handleRetrySource = async (sourceId: string) => {
    try {
      await retrySource.mutateAsync(sourceId)
    } catch (error) {
      console.error('Failed to retry source:', error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!sourceToDelete) return
    try {
      await deleteSource.mutateAsync({ id: sourceToDelete, notebookId: kbId })
      setExcludedSourceIds((prev) => prev.filter((id) => id !== sourceToDelete))
      setDeleteDialogOpen(false)
      setSourceToDelete(null)
    } catch (error) {
      console.error('Failed to delete source:', error)
    }
  }

  if (!notebook && !notebookLoading) {
    return (
      <AppShell>
        <div className="p-8">
          <p className="text-sm text-muted-foreground">{t('empty.kb')}</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/notebooks')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('action.back')}
              </Button>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground leading-none">
                  {t('nav.knowledgeBases')}
                </p>
                <h1 className="text-xl font-semibold leading-tight">{notebook?.name ?? ''}</h1>
                <p className="text-[13px] text-muted-foreground mt-0.5 max-w-2xl">
                  {notebook?.description || t('hint.sources')}
                </p>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground leading-none">
              {t('label.selectedSources')}: {selectedSources.length}/{kbSources.length}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <div className="h-full w-full overflow-x-auto" ref={gridContainerRef}>
            <div
              className="h-full min-w-[980px] grid"
              data-testid="notebook-columns"
              style={{
                gridTemplateColumns: `${effectiveColumns.sources}px 8px ${effectiveColumns.chat}px 8px ${effectiveColumns.notes}px`,
              }}
            >
              <section
                className="rounded-2xl border border-border/70 bg-card/70 p-5 flex flex-col min-h-0"
                data-testid="column-sources"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-primary" />
                    {t('section.sources')}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {kbSources.length}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-1">
                  {t('hint.sourcesSelected')}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => { setUploadMode('file'); setUploadOpen(true) }}
                    data-testid="upload-file"
                  >
                    <FileUp className="h-4 w-4" />
                    {t('upload.file')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => { setUploadMode('url'); setUploadOpen(true) }}
                    data-testid="upload-url"
                  >
                    <Globe className="h-4 w-4" />
                    {t('upload.website')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => { setUploadMode('paste'); setUploadOpen(true) }}
                    data-testid="upload-paste"
                  >
                    <Clipboard className="h-4 w-4" />
                    {t('upload.paste')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => { setUploadMode('quickNote'); setUploadOpen(true) }}
                    data-testid="upload-quick-note"
                  >
                    <PenLine className="h-4 w-4" />
                    {t('upload.quickNote')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setAddExistingOpen(true)}
                    className="col-span-2"
                    data-testid="add-existing-source"
                  >
                    <Link2 className="h-4 w-4" />
                    {t('action.addExistingSource')}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {t('upload.fileHint')}
                </p>

                <div
                  className="mt-4 flex-1 space-y-2 overflow-y-auto pr-2"
                  data-testid="sources-list"
                >
                  {!sourcesLoading && kbSources.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                      {t('empty.source')}
                    </div>
                  )}
                  {sourcesLoading && (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                      {t('status.processing')}
                    </div>
                  )}
                  {kbSources.map((source) => {
                    const isSelected = !excludedSourceIds.includes(source.id)
                    return (
                      <NotebookSourceRow
                        key={source.id}
                        source={source}
                        isSelected={isSelected}
                        onToggle={() => toggleSource(source.id)}
                        onDelete={() => handleDeleteSource(source.id)}
                        onRetry={() => handleRetrySource(source.id)}
                        onOpen={() => openModal('source', source.id)}
                        deleteDisabled={deleteSource.isPending}
                        retryDisabled={retrySource.isPending}
                        t={t}
                      />
                    )
                  })}
                </div>
              </section>

              <div
                role="separator"
                onPointerDown={(event) =>
                  setDragging({ edge: 'sources', startX: event.clientX, startSizes: columnSizes })
                }
                className="cursor-col-resize"
              >
                <div className="h-full w-full rounded-full bg-border/40 hover:bg-primary/30 transition-colors" />
              </div>

              <section
                className="rounded-2xl border border-border/70 bg-card/70 p-5 flex flex-col min-h-0"
                data-testid="column-chat"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {t('section.chat')}
                  </div>
                  <div className="flex items-center gap-1">
                                        <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setClearChatDialogOpen(true)}
                      disabled={!currentSessionId || messages.length === 0}
                      className="h-7 w-7"
                      title="清空聊天记录"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Sparkles className="h-4 w-4 text-primary/70" />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  {t('label.selectedSources')}: {selectedSources.length}
                </div>
                {lastError && (
                  <div className="mt-3 rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-rose-700">
                          {t('chat.error.title')}
                        </p>
                        <p className="text-xs text-rose-700/80">
                          {lastError.type === 'session'
                            ? t('chat.error.session')
                            : lastError.type === 'network'
                              ? t('chat.error.network')
                              : t('chat.error.generic')}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          {lastError.type === 'session' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                resetSession()
                                clearError()
                              }}
                            >
                              {t('chat.action.rebuildSession')}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              retryLastMessage()
                            }}
                          >
                            {t('action.retry')}
                          </Button>
                          {lastError.message && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setShowChatErrorDetails((prev) => !prev)}
                            >
                              {showChatErrorDetails ? t('action.hideDetails') : t('action.details')}
                            </Button>
                          )}
                        </div>
                        {showChatErrorDetails && lastError.message && (
                          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-rose-100/60 px-2 py-1 font-mono text-[10px] text-rose-700/80">
                            {lastError.message}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="flex-1 overflow-y-auto mt-4 space-y-3 pr-2"
                  data-testid="chat-list"
                >
                  {messages.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                      {t('hint.notes')}
                    </div>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'human' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        message.type === 'human'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background/80 border border-border/60'
                      }`}
                      >
                        {message.type === 'human' ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <MessageContent content={message.content} citations={message.citations} />
                        )}
                        {message.type === 'ai' && (
                          <div className="mt-2 space-y-2">
                            <button
                              onClick={() => handleSaveAnswer(message.content)}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                              {t('action.saveToNotes')}
                            </button>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(message.content, message.id)}
                              >
                                <Copy className="h-3 w-3" />
                                {copiedId === message.id ? t('action.copied') : t('action.copy')}
                              </Button>
                              <Button
                                variant={feedback[message.id] === 'up' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => toggleFeedback(message.id, 'up')}
                              >
                                <ThumbsUp className="h-3 w-3" />
                                {t('action.goodAnswer')}
                              </Button>
                              <Button
                                variant={feedback[message.id] === 'down' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => toggleFeedback(message.id, 'down')}
                              >
                                <ThumbsDown className="h-3 w-3" />
                                {t('action.badAnswer')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-background/80 border border-border/60">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">
                            {streamPhase === 'retrieving'
                              ? '检索中...'
                              : streamPhase === 'saving'
                                ? '整理中...'
                                : streamStatus === 'submitted'
                                  ? '请求已发送...'
                                  : '生成中...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="mt-4 border-t border-border/60 pt-3 flex gap-2">
                  <Textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={t('chat.placeholder')}
                    rows={1}
                    className="min-h-[40px] max-h-[120px] resize-none"
                    disabled={isSending}
                    data-testid="chat-input"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isSending}
                    data-testid="chat-send"
                  >
                    {t('action.send')}
                  </Button>
                </div>
              </section>

              <div
                role="separator"
                onPointerDown={(event) =>
                  setDragging({ edge: 'notes', startX: event.clientX, startSizes: columnSizes })
                }
                className="cursor-col-resize"
              >
                <div className="h-full w-full rounded-full bg-border/40 hover:bg-primary/30 transition-colors" />
              </div>

              <section
                className="rounded-2xl border border-border/70 bg-card/70 p-5 flex flex-col min-h-0"
                data-testid="column-notes"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <StickyNote className="h-4 w-4 text-primary" />
                    {t('section.notes')}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleNewNote} data-testid="notes-new">
                    {t('action.newNote')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('hint.notes')}
                </p>

                <div className="mt-4 flex-1 min-h-0 flex flex-col gap-3">
                  <div
                    className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2"
                    data-testid="notes-list"
                  >
                    {!notesLoading && kbNotes.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                        {t('empty.note')}
                      </div>
                    )}
                    {notesLoading && (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                        {t('status.processing')}
                      </div>
                    )}
                    {kbNotes.map((note) => {
                      const isLocked = note.note_type === 'source'
                      const notePreview = note.content?.trim().split('\n')[0] || t('label.content')
                      return (
                        <button
                          key={note.id}
                          onClick={() => {
                            setSelectedNoteId(note.id)
                            setNoteContent(note.content ?? '')
                          }}
                          className={`w-full text-left rounded-xl border border-border/60 px-3 py-2 text-sm ${
                            selectedNote?.id === note.id ? 'bg-primary/10 border-primary/40' : 'bg-background/70'
                          }`}
                          data-testid={`note-item-${note.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium line-clamp-1">{notePreview}</p>
                            {isLocked && (
                              <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                                {t('status.completed')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {note.content || ''}
                          </p>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex-1 min-h-0 border-t border-border/60 pt-3 flex flex-col gap-3">
                    <div className="space-y-2 flex-1 flex flex-col">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('label.content')}
                      </label>
                      <Textarea
                        value={noteContent}
                        onChange={(event) => setNoteContent(event.target.value)}
                        rows={4}
                        className="flex-1 min-h-[160px]"
                        disabled={selectedNote?.note_type === 'source'}
                        data-testid="note-editor"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={handleSaveNote}
                        disabled={!noteContent.trim() || selectedNote?.note_type === 'source'}
                        data-testid="note-save"
                      >
                        {t('action.saveNote')}
                      </Button>
                        <Button
                          variant="secondary"
                          onClick={handleConvertNote}
                          disabled={!selectedNote || selectedNote.note_type === 'source' || convertingNoteId === selectedNote.id}
                          data-testid="note-convert"
                        >
                          {t('action.convertToSource')}
                        </Button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open)
          if (!open) {
            setUploadFile(null)
            setUploadFileName('')
            setUploadUrl('')
            setUploadText('')
            setUploadQuickNoteId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]" data-testid="upload-dialog">
          <DialogHeader>
            <DialogTitle>
              {uploadMode === 'file'
                ? t('upload.file')
                : uploadMode === 'url'
                  ? t('upload.website')
                  : uploadMode === 'paste'
                    ? t('upload.paste')
                    : t('upload.quickNote')}
            </DialogTitle>
            <DialogDescription>
              {uploadMode === 'file'
                ? t('upload.fileHint')
                : uploadMode === 'url'
                  ? t('upload.websiteHint')
                  : uploadMode === 'paste'
                    ? t('upload.pasteHint')
                    : t('upload.quickNoteHint')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {uploadMode === 'file' && (
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.html,.pptx"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setUploadFile(file)
                    setUploadFileName(file?.name || '')
                  }}
                  data-testid="upload-file-input"
                />
                {uploadFileName && (
                  <p className="text-xs text-muted-foreground">{uploadFileName}</p>
                )}
              </div>
            )}
            {uploadMode === 'url' && (
              <div className="space-y-2">
                <Input
                  value={uploadUrl}
                  onChange={(event) => setUploadUrl(event.target.value)}
                  placeholder="https://"
                  data-testid="upload-url-input"
                />
              </div>
            )}
            {uploadMode === 'paste' && (
              <div className="space-y-2">
                <Textarea
                  value={uploadText}
                  onChange={(event) => setUploadText(event.target.value)}
                  rows={6}
                  data-testid="upload-paste-input"
                />
              </div>
            )}
            {uploadMode === 'quickNote' && (
              <div
                className="space-y-3 max-h-[260px] overflow-y-auto pr-2"
                data-testid="upload-quick-note-list"
              >
                {quickNoteLoading ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                    {t('quickNote.loading')}
                  </div>
                ) : quickNotes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                    {t('empty.quickNote')}
                  </div>
                ) : (
                  quickNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => setUploadQuickNoteId(note.id)}
                      className={`w-full text-left rounded-xl border border-border/60 px-3 py-2 text-sm transition-colors ${
                        uploadQuickNoteId === note.id
                          ? 'bg-primary/10 border-primary/40'
                          : 'bg-background/70 hover:bg-muted/40'
                      }`}
                    >
                      <p className="font-medium">{note.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {note.preview}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} data-testid="upload-cancel">
              {t('action.cancel')}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                (uploadMode === 'file' && !uploadFileName) ||
                (uploadMode === 'url' && !uploadUrl.trim()) ||
                (uploadMode === 'paste' && !uploadText.trim()) ||
                (uploadMode === 'quickNote' && !uploadQuickNoteId)
              }
              data-testid="upload-confirm"
            >
              {t('action.uploadSource')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddExistingSourceDialog
        open={addExistingOpen}
        onOpenChange={setAddExistingOpen}
        notebookId={kbId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sources(kbId) })
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setSourceToDelete(null)
          }
        }}
        title={t('source.delete')}
        description={t('source.deleteConfirmLong')}
        confirmText={t('action.delete')}
        confirmVariant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteSource.isPending}
      />

      <ConfirmDialog
        open={clearChatDialogOpen}
        onOpenChange={setClearChatDialogOpen}
        title="清空聊天记录"
        description="确定要清空当前聊天记录吗？此操作无法撤销。"
        confirmText="清空"
        confirmVariant="destructive"
        onConfirm={async () => {
          if (currentSessionId) {
            deleteSession(currentSessionId)
            setClearChatDialogOpen(false)
          }
        }}
      />
    </AppShell>
  )
}
