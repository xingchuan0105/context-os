'use client'

import { useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { useKnowledgeBases } from '@/lib/hooks/use-knowledge-bases'
import {
  useKnowledgeBaseShares,
  useCreateKnowledgeBaseShare,
  useRevokeKnowledgeBaseShare,
} from '@/lib/hooks/use-share-links'
import { Copy, Link2, ShieldCheck, Clock, Share2, Layers } from 'lucide-react'

const statusTone: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-amber-100 text-amber-700',
  revoked: 'bg-slate-100 text-slate-700',
}

const formatDate = (value: string, locale: 'zh' | 'en') => {
  const date = new Date(value)
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export default function SharePage() {
  const { t, locale } = useI18n()
  const { data: knowledgeBases = [] } = useKnowledgeBases()
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null)
  const kbId = useMemo(() => {
    if (selectedKbId && knowledgeBases.some((kb) => kb.id === selectedKbId)) {
      return selectedKbId
    }
    return knowledgeBases[0]?.id ?? ''
  }, [selectedKbId, knowledgeBases])
  const { data: shares = [] } = useKnowledgeBaseShares(kbId)
  const createShareMutation = useCreateKnowledgeBaseShare()
  const revokeShareMutation = useRevokeKnowledgeBaseShare()
  const [expiry, setExpiry] = useState('7d')
  const [permission, setPermission] = useState<'chat' | 'full'>('chat')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const shareList = useMemo(
    () => [...shares].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [shares]
  )
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const expiryOptions = [
    { value: '1d', days: 1, label: t('share.expiry.1d') },
    { value: '7d', days: 7, label: t('share.expiry.7d') },
    { value: '30d', days: 30, label: t('share.expiry.30d') },
    { value: 'never', days: null, label: t('share.expiry.never') },
  ]
  const permissionOptions = [
    { value: 'chat', label: t('share.permission.chat') },
    { value: 'full', label: t('share.permission.full') },
  ]

  const handleGenerate = () => {
    if (!kbId) return
    const selected = expiryOptions.find((item) => item.value === expiry)
    const payload: { expiryDays?: number; permissions: string } = {
      permissions: permission,
    }
    if (selected?.days != null) {
      payload.expiryDays = selected.days
    }
    createShareMutation.mutate({ kbId, payload })
  }

  const handleCopy = async (shareId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(shareId)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (error) {
      console.error(error)
    }
  }

  const getStatusKey = (share: typeof shares[number]) => {
    if (share.revokedAt) return 'share.status.revoked'
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return 'share.status.expired'
    }
    return 'share.status.active'
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <Share2 className="h-3 w-3" />
                {t('nav.share')}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('nav.share')}
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                {t('hint.share')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.4fr] gap-6">
            <section className="rounded-2xl border border-border/70 bg-card/70 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4 text-primary" />
                {t('share.createTitle')}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('label.kb')}
                  </label>
                  <Select value={kbId} onValueChange={setSelectedKbId}>
                    <SelectTrigger
                      className="w-full bg-card/70 border-border/60"
                      data-testid="share-kb-select"
                    >
                      <SelectValue placeholder={t('label.kb')} />
                    </SelectTrigger>
                    <SelectContent>
                      {knowledgeBases.map((kb) => (
                        <SelectItem
                          key={kb.id}
                          value={kb.id}
                          data-testid="share-kb-option"
                          data-kb-id={kb.id}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            {kb.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('label.permission')}
                  </label>
                  <Select value={permission} onValueChange={(value) => setPermission(value as 'chat' | 'full')}>
                    <SelectTrigger
                      className="w-full bg-card/70 border-border/60"
                      data-testid="share-permission-select"
                    >
                      <SelectValue placeholder={t('label.permission')} />
                    </SelectTrigger>
                    <SelectContent>
                      {permissionOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          data-testid="share-permission-option"
                          data-permission={option.value}
                        >
                          <span className="inline-flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {permission === 'full' && (
                    <p className="text-xs text-muted-foreground">
                      {t('share.permission.fullHint')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('label.expiry')}
                  </label>
                  <Select value={expiry} onValueChange={setExpiry}>
                    <SelectTrigger
                      className="w-full bg-card/70 border-border/60"
                      data-testid="share-expiry-select"
                    >
                      <SelectValue placeholder={t('label.expiry')} />
                    </SelectTrigger>
                    <SelectContent>
                      {expiryOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          data-testid="share-expiry-option"
                          data-expiry={option.value}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleGenerate}
                  disabled={!kbId || createShareMutation.isPending}
                  data-testid="share-generate"
                >
                  {t('action.generate')}
                </Button>
              </div>
            </section>

            <section
              className="rounded-2xl border border-border/70 bg-card/70 p-5 flex flex-col min-h-0"
              data-testid="share-list"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Share2 className="h-4 w-4 text-primary" />
                  {t('share.historyTitle')}
                </div>
                <span className="text-xs text-muted-foreground">
                  {shareList.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('share.permissionHint')}
              </p>

              <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-2">
                {shareList.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                    {t('empty.share')}
                  </div>
                )}
                {shareList.map((share) => {
                  const statusKey = getStatusKey(share)
                  const status = statusKey.split('.').pop() || 'active'
                  const permissionLabel = share.permissions === 'full'
                    ? t('share.permission.full')
                    : t('share.permission.chat')
                  const kbName =
                    knowledgeBases.find((kb) => kb.id === share.kbId)?.title ||
                    t('label.kb')
                  const shareUrl = baseUrl
                    ? `${baseUrl}/share/${share.token}`
                    : share.url || ''
                  return (
                    <div
                      key={share.id}
                      className="rounded-xl border border-border/60 bg-background/70 p-4 space-y-3"
                      data-testid="share-item"
                      data-share-id={share.id}
                      data-share-token={share.token}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{kbName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {permissionLabel} - {t('label.created')}:{' '}
                            {formatDate(share.createdAt, locale)}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full ${statusTone[status]}`}
                        >
                          {t(statusKey as 'share.status.active')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={shareUrl}
                          readOnly
                          className="min-w-[220px] flex-1 bg-muted/50"
                          data-testid="share-link-input"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(share.id, shareUrl)}
                          disabled={!shareUrl}
                          data-testid="share-copy"
                        >
                          <Copy className="h-4 w-4" />
                          {copiedId === share.id
                            ? t('share.linkCopied')
                            : t('action.copyLink')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            revokeShareMutation.mutate({
                              kbId: share.kbId || kbId,
                              shareId: share.id,
                            })
                          }
                          disabled={!!share.revokedAt || revokeShareMutation.isPending}
                          data-testid="share-revoke"
                        >
                          {t('action.revoke')}
                        </Button>
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {t('label.expiry')}: {' '}
                        {share.expiresAt
                          ? formatDate(share.expiresAt, locale)
                          : t('share.expiry.never')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
