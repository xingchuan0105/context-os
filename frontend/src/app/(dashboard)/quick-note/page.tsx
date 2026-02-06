'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import { USE_MOCK_DATA } from '@/lib/mock/flags'
import { useMockStore } from '@/lib/mock/store'
import quickNotesApi from '@/lib/api/quick-notes'
import type {
  QuickNoteDetail,
  QuickNoteListItem,
  QuickNoteMessage,
} from '@/lib/types/api'
import {
  Bot,
  MessageSquareText,
  PenLine,
  Save,
  Sparkles,
  Trash2,
  User,
  CheckSquare,
  Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

type MessageWithId = QuickNoteMessage & {
  id: string
  createdAt: string
}

type Translate = (key: any, params?: Record<string, string | number>) => string

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id_${Math.random().toString(36).slice(2, 10)}`
}

const formatDate = (value: string, locale: 'zh' | 'en') => {
  const date = new Date(value)
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const buildMarkdown = (
  label: string,
  messages: QuickNoteMessage[],
  locale: 'zh' | 'en',
  t: Translate
) => {
  const titlePrefix = t('quickNote.markdown.titlePrefix')
  const timePrefix = t('quickNote.markdown.timePrefix')
  const dialogueLabel = t('quickNote.markdown.dialogueLabel')
  const roleLabel = (role: QuickNoteMessage['role']) =>
    role === 'user' ? t('quickNote.markdown.role.user') : t('quickNote.markdown.role.ai')

  const body = messages
    .map((msg) => `[${roleLabel(msg.role)}] ${msg.content}`)
    .join('\n\n')

  return [
    `# ${titlePrefix} \u00B7 ${label}`,
    `${timePrefix}${new Date().toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}`,
    '',
    `## ${dialogueLabel}`,
    '',
    body,
  ].join('\n')
}

const buildFallbackLabel = (
  messages: QuickNoteMessage[],
  locale: 'zh' | 'en',
  t: Translate
) => {
  const firstUser = messages.find((msg) => msg.role === 'user')?.content ?? ''
  const fallback = t('quickNote.fallbackTitle')
  return firstUser ? firstUser.slice(0, locale === 'zh' ? 12 : 32) : fallback
}

export default function QuickNotePage() {
  const { t, locale } = useI18n()
  const mockQuickNotes = useMockStore((state) => state.quickNotes)
  const saveMockQuickNote = useMockStore((state) => state.saveQuickNote)

  const [messages, setMessages] = useState<MessageWithId[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())

  const [history, setHistory] = useState<QuickNoteListItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [historyDetail, setHistoryDetail] = useState<QuickNoteDetail | null>(null)
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false)
  const [pendingMessages, setPendingMessages] = useState<QuickNoteMessage[]>([])
  const [saveMode, setSaveMode] = useState<'all' | 'selected'>('all')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickNoteList = useMemo(() => {
    if (!USE_MOCK_DATA) {
      return history
    }
    return mockQuickNotes.map((note) => ({
      id: note.id,
      label: note.label,
      preview: note.preview,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }))
  }, [history, mockQuickNotes])

  useEffect(() => {
    if (USE_MOCK_DATA) return
    let active = true
    setHistoryLoading(true)
    quickNotesApi
      .list()
      .then((data) => {
        if (active) setHistory(data)
      })
      .catch((error) => {
        console.error('Failed to load quick notes:', error)
        toast.error(t('quickNote.loadFailed'))
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })
    return () => {
      active = false
    }
  }, [locale])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const resetChat = () => {
    setMessages([])
    setInput('')
    setSelectionMode(false)
    setSelectedMessageIds(new Set())
    setSelectedHistoryId(null)
    setHistoryDetail(null)
  }

  const toggleSelectMessage = (id: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const content = input.trim()
    const userMessage: MessageWithId = {
      id: createId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)

    try {
      if (USE_MOCK_DATA) {
        const mockResponse = locale === 'zh'
          ? `\u6211\u8BB0\u4E0B\u4E86\uFF1A${content}\u3002\u4F60\u66F4\u5173\u6CE8\u201C\u4E8B\u5B9E\u6574\u7406\u201D\u8FD8\u662F\u201C\u4E0B\u4E00\u6B65\u884C\u52A8\u201D\uFF1F`
          : `Captured: ${content}. Are you focusing on facts or next actions?`
        const aiMessage: MessageWithId = {
          id: createId(),
          role: 'assistant',
          content: mockResponse,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, aiMessage])
        return
      }

      const response = await quickNotesApi.chat({
        messages: nextMessages.map((msg) => ({ role: msg.role, content: msg.content })),
        locale,
      })
      const aiMessage: MessageWithId = {
        id: createId(),
        role: 'assistant',
        content: response.message,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('Quick note chat failed:', error)
      toast.error(t('quickNote.chatFailed'))
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      handleSend()
    }
  }

  const openSaveDialog = async (mode: 'all' | 'selected') => {
    const selectedMessages =
      mode === 'selected'
        ? messages.filter((msg) => selectedMessageIds.has(msg.id))
        : messages

    if (selectedMessages.length === 0) {
      toast.error(t('quickNote.selectMessagesToSave'))
      return
    }

    setSaveMode(mode)
    setPendingMessages(selectedMessages.map((msg) => ({ role: msg.role, content: msg.content })))
    setSaveLabel('')
    setSaveDialogOpen(true)
    setIsGeneratingLabel(true)

    try {
      if (USE_MOCK_DATA) {
        setSaveLabel(buildFallbackLabel(selectedMessages, locale, t))
        return
      }
      const labelResponse = await quickNotesApi.label({
        messages: selectedMessages.map((msg) => ({ role: msg.role, content: msg.content })),
        locale,
      })
      setSaveLabel(labelResponse.label || buildFallbackLabel(selectedMessages, locale, t))
    } catch (error) {
      console.error('Label generation failed:', error)
      setSaveLabel(buildFallbackLabel(selectedMessages, locale, t))
    } finally {
      setIsGeneratingLabel(false)
    }
  }

  const handleSave = async () => {
    if (pendingMessages.length === 0) return
    if (!saveLabel.trim()) {
      toast.error(t('quickNote.labelRequired'))
      return
    }

    try {
      if (USE_MOCK_DATA) {
        const markdown = buildMarkdown(saveLabel.trim(), pendingMessages, locale, t)
        saveMockQuickNote(saveLabel.trim(), markdown, locale)
      } else {
        const saved = await quickNotesApi.save({
          messages: pendingMessages,
          label: saveLabel.trim(),
          locale,
        })
        setHistory((prev) => [saved, ...prev])
      }
      toast.success(t('quickNote.saved'))
      setSaveDialogOpen(false)
      setPendingMessages([])
      setSaveLabel('')
      setSelectedMessageIds(new Set())
      setSelectionMode(false)
      setMessages([])
    } catch (error) {
      console.error('Save quick note failed:', error)
      toast.error(t('quickNote.saveFailed'))
    }
  }

  const handleSelectHistory = async (noteId: string) => {
    setSelectedHistoryId(noteId)
    setHistoryDetail(null)
    setHistoryDetailLoading(true)

    try {
      if (USE_MOCK_DATA) {
        const note = mockQuickNotes.find((entry) => entry.id === noteId)
        if (note) {
          setHistoryDetail({
            id: note.id,
            label: note.label,
            content: note.content,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          })
        }
        return
      }
      const detail = await quickNotesApi.get(noteId)
      setHistoryDetail(detail)
    } catch (error) {
      console.error('Failed to load quick note detail:', error)
      toast.error(t('quickNote.loadDetailFailed'))
    } finally {
      setHistoryDetailLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <PenLine className="h-3 w-3" />
                {t('nav.quickNote')}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('nav.quickNote')}
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                {t('hint.quickNote')}
              </p>
            </div>
            <Button variant="outline" onClick={resetChat}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('action.newQuickNote')}
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6 min-h-[560px]">
            <section className="rounded-2xl border border-border/70 bg-card/70 p-5 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t('section.quickNote')}
                </div>
                <span className="text-xs text-muted-foreground">
                  {quickNoteList.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('quickNote.historyHint')}
              </p>
              <div className="mt-4 flex-1 min-h-0">
                <ScrollArea className="h-full pr-2" data-testid="quick-note-history">
                  {historyLoading && (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                      {t('quickNote.loading')}
                    </div>
                  )}
                  {!historyLoading && quickNoteList.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                      {t('empty.quickNote')}
                    </div>
                  )}
                  <div className="space-y-3">
                    {quickNoteList.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => handleSelectHistory(note.id)}
                        className={`w-full text-left rounded-xl border border-border/60 px-3 py-2 text-sm transition-colors ${
                          selectedHistoryId === note.id
                            ? 'bg-primary/10 border-primary/40'
                            : 'bg-background/70 hover:bg-muted/40'
                        }`}
                        data-testid="quick-note-item"
                        data-note-id={note.id}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{note.label}</p>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(note.updatedAt, locale)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {note.preview}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card/70 p-5 flex flex-col min-h-0">
              {selectedHistoryId ? (
                <div className="flex flex-col min-h-0 h-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <MessageSquareText className="h-4 w-4 text-primary" />
                      {historyDetail?.label || t('quickNote.loading')}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedHistoryId(null)}>
                      {t('action.back')}
                    </Button>
                  </div>
                  <div className="mt-4 flex-1 min-h-0">
                    <ScrollArea className="h-full pr-2">
                      {historyDetailLoading || !historyDetail ? (
                        <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                          {t('quickNote.loading')}
                        </div>
                      ) : (
                        <div className="prose prose-sm prose-neutral max-w-none break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {historyDetail.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col min-h-0 h-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Bot className="h-4 w-4 text-primary" />
                      {t('quickNote.chatTitle')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectionMode((prev) => !prev)
                          setSelectedMessageIds(new Set())
                        }}
                        disabled={messages.length === 0}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        {selectionMode ? t('action.cancelSelect') : t('action.select')}
                      </Button>
                      {selectionMode && (
                        <Button
                          size="sm"
                          onClick={() => openSaveDialog('selected')}
                          disabled={selectedMessageIds.size === 0}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {t('action.saveSelected')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => openSaveDialog('all')}
                        disabled={messages.length === 0}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {t('action.saveQuickNote')}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex-1 min-h-0">
                    <ScrollArea className="h-full pr-2">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">
                          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="text-sm">{t('quickNote.chatEmptyTitle')}</p>
                          <p className="text-xs mt-2">{t('quickNote.chatEmptyHint')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map((message) => {
                            const isUser = message.role === 'user'
                            const isSelected = selectedMessageIds.has(message.id)
                            return (
                              <div
                                key={message.id}
                                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                              >
                                {!isUser && (
                                  <div className="flex-shrink-0">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                      <Bot className="h-4 w-4" />
                                    </div>
                                  </div>
                                )}
                                <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                                  {selectionMode && (
                                    <div className="pt-1">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleSelectMessage(message.id)}
                                      />
                                    </div>
                                  )}
                                  <div
                                    className={`rounded-lg px-4 py-2 text-sm break-words max-w-[320px] sm:max-w-[420px] ${
                                      isUser
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                    } ${selectionMode ? 'cursor-pointer' : ''} ${
                                      isSelected ? 'ring-2 ring-primary/40' : ''
                                    }`}
                                    onClick={() => {
                                      if (selectionMode) {
                                        toggleSelectMessage(message.id)
                                      }
                                    }}
                                  >
                                    {message.content}
                                  </div>
                                </div>
                                {isUser && (
                                  <div className="flex-shrink-0">
                                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                                      <User className="h-4 w-4 text-primary-foreground" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {isSending && (
                            <div className="flex gap-3 justify-start">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Bot className="h-4 w-4" />
                                </div>
                              </div>
                              <div className="rounded-lg px-4 py-2 bg-muted">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <div className="pt-4 border-t mt-4">
                    <div className="flex gap-2 items-end">
                      <Textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('quickNote.chatPlaceholder')}
                        className="flex-1 min-h-[40px] max-h-[120px] resize-none py-2 px-3"
                        rows={1}
                      />
                      <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isSending}
                        size="icon"
                        className="h-[40px] w-[40px] flex-shrink-0"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PenLine className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('quickNote.saveTitle')}</DialogTitle>
            <DialogDescription>
              {saveMode === 'selected'
                ? t('quickNote.saveSelectedHint')
                : t('quickNote.saveAllHint')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('quickNote.labelTitle')}
            </label>
            <Input
              value={saveLabel}
              onChange={(event) => setSaveLabel(event.target.value)}
              placeholder={t('quickNote.labelPlaceholder')}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {isGeneratingLabel && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('quickNote.labelHint')}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!saveLabel.trim()}>
              {t('action.saveQuickNote')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

