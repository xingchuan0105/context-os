'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useI18n } from '@/lib/i18n'
import { useSharedLink, useSharedSources, useSharedSourceIds } from '@/lib/hooks/use-share-links'
import { chatApi as contextChatApi } from '@/lib/api/chat-context-os'
import { useToast } from '@/lib/hooks/use-toast'
import { FileText, MessageSquare, ShieldCheck, Clock, Share2 } from 'lucide-react'

type ShareChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const statusTone: Record<string, string> = {
  queued: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
}

const formatDate = (value: string, locale: 'zh' | 'en') => {
  const date = new Date(value)
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export default function ShareChatPage() {
  const params = useParams()
  const { t, locale } = useI18n()
  const { toast } = useToast()
  const [chatInput, setChatInput] = useState('')
  const [isWaiting, setIsWaiting] = useState(false)
  const [messages, setMessages] = useState<ShareChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [excludedSourceIds, setExcludedSourceIds] = useState<string[]>([])

  const token = decodeURIComponent(params.token as string)
  const sharedLinkQuery = useSharedLink(token)
  const shareData =
    sharedLinkQuery.data?.type === 'knowledge_base'
      ? sharedLinkQuery.data
      : null
  const kbId = shareData?.knowledgeBase?.id ?? ''
  const sharePermission = shareData?.share.permissions || 'chat'
  const shareStatus = useMemo(() => {
    if (!shareData) return 'invalid'
    if (shareData.share.expiresAt && new Date(shareData.share.expiresAt) < new Date()) {
      return 'expired'
    }
    return 'active'
  }, [shareData])

  const canViewSources = sharePermission
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .includes('full')
  const sourcesQuery = useSharedSources(token, {
    enabled: !!shareData && shareStatus === 'active' && canViewSources,
  })
  const sourceIdsQuery = useSharedSourceIds(token, {
    enabled: !!shareData && shareStatus === 'active' && !canViewSources,
  })
  const kbSources = sourcesQuery.data ?? []
  const selectedSourceIds = canViewSources
    ? kbSources.filter((source) => !excludedSourceIds.includes(source.id)).map((source) => source.id)
    : sourceIdsQuery.data ?? []

  const isActive = shareStatus === 'active'
  const kbName = shareData?.knowledgeBase?.title || t('label.kb')
  const permissionLabel = canViewSources ? t('share.permission.full') : t('share.permission.chat')

  const normalizeStatus = (status?: string) => {
    if (!status) return 'completed'
    if (status === 'queued' || status === 'processing' || status === 'completed' || status === 'failed') {
      return status
    }
    return 'completed'
  }

  const toggleSource = (sourceId: string) => {
    setExcludedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    )
  }

  const handleSendMessage = async () => {
    if (!shareData || !chatInput.trim() || isWaiting) return
    if (selectedSourceIds.length === 0) {
      toast({
        title: t('share.error.title'),
        description: t('share.error.noSources'),
        variant: 'destructive',
      })
      return
    }

    const messageText = chatInput.trim()
    setChatInput('')

    const userMessage: ShareChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
    }
    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: 'assistant', content: '' },
    ])
    setIsWaiting(true)

    let activeSessionId = sessionId
    if (!activeSessionId) {
      try {
        const session = await contextChatApi.createSession({
          kbId,
          title: messageText.length > 30 ? `${messageText.slice(0, 30)}...` : messageText,
        })
        activeSessionId = session.id
        setSessionId(activeSessionId)
      } catch {
        setIsWaiting(false)
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantId))
        toast({
          title: t('share.error.title'),
          description: t('share.error.createSessionFailed'),
          variant: 'destructive',
        })
        return
      }
    }

    await contextChatApi.streamChat(
      activeSessionId,
      messageText,
      (chunk) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: `${msg.content}${chunk}` }
              : msg
          )
        )
      },
      () => {
        setIsWaiting(false)
      },
      (errorMessage) => {
        setIsWaiting(false)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId && !msg.content
              ? { ...msg, content: errorMessage }
              : msg
          )
        )
        toast({
          title: t('share.error.title'),
          description: errorMessage,
          variant: 'destructive',
        })
      },
      {
        selectedSourceIds,
        systemPrompt: t('share.systemPrompt'),
      }
    )
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="p-6 border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('nav.share')}
              </p>
              <h1 className="text-2xl font-semibold">{kbName}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {canViewSources ? t('hint.sourcesSelected') : t('share.chatOnlyHint')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-1">
                <ShieldCheck className="h-3 w-3" />
                {permissionLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-1">
                <Clock className="h-3 w-3" />
                {shareData?.share.expiresAt
                  ? formatDate(shareData.share.expiresAt, locale)
                  : t('share.expiry.never')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-1">
                <Share2 className="h-3 w-3" />
                {t(`share.status.${shareStatus}` as 'share.status.active')}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-hidden">
          {sharedLinkQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-8 text-center text-sm text-muted-foreground">
              ...
            </div>
          ) : !shareData || !isActive ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-8 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {t('share.invalidTitle')}
              </p>
              <p className="mt-2">{t('share.invalidHint')}</p>
            </div>
          ) : (
            <div className="h-full w-full overflow-x-auto">
              <section
                className={`grid h-full gap-4 ${canViewSources ? 'min-w-[720px]' : 'min-w-[360px]'}`}
                data-testid="share-columns"
                style={{
                  gridTemplateColumns: canViewSources
                    ? 'minmax(240px, 1fr) minmax(360px, 2fr)'
                    : 'minmax(360px, 1fr)',
                }}
              >
              {canViewSources && (
                <Card className="flex flex-col min-h-0" data-testid="share-source-column">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        {t('section.sources')}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {t('label.selectedSources')}: {selectedSourceIds.length}/{kbSources.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('hint.sourcesSelected')}</p>
                  </CardHeader>
                  <CardContent
                    className="flex-1 overflow-y-auto min-h-0 space-y-3"
                    data-testid="share-sources-list"
                  >
                    {sourcesQuery.isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner />
                      </div>
                    ) : kbSources.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title={t('empty.source')}
                        description={t('hint.sources')}
                      />
                    ) : (
                      kbSources.map((source) => {
                        const status = normalizeStatus(source.status)
                        const isSelected = !excludedSourceIds.includes(source.id)
                        return (
                          <div
                            key={source.id}
                            className="rounded-xl border border-border/60 bg-background/70 p-3 flex items-start gap-3"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSource(source.id)}
                              className="mt-1"
                              data-testid={`share-source-toggle-${source.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium truncate">
                                    {source.file_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {source.mime_type || t('source.document')}
                                  </p>
                                </div>
                                <span className={`text-[10px] px-2 py-1 rounded-full ${statusTone[status]}`}>
                                  {t(`status.${status}` as 'status.completed')}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="flex flex-col min-h-0" data-testid="share-chat-column">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {t('section.chat')}
                  </CardTitle>
                </CardHeader>
                <CardContent
                  className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-2"
                  data-testid="share-chat-list"
                >
                  {messages.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                      {t('hint.notes')}
                    </div>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background/80 border border-border/60'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {isWaiting && (
                    <div className="text-xs text-muted-foreground">...</div>
                  )}
                </CardContent>
                <div className="border-t border-border/60 p-3 flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder={t('chat.placeholder')}
                    disabled={!isActive}
                    data-testid="share-chat-input"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isWaiting || !isActive}
                    data-testid="share-chat-send"
                  >
                    {t('action.send')}
                  </Button>
                </div>
              </Card>

              </section>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
