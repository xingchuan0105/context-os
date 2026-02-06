'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { useCreateNotebook, useDeleteNotebook, useNotebooks } from '@/lib/hooks/use-notebooks'
import { Plus, Layers, ArrowUpRight, FolderPlus, LayoutGrid, List, Trash2 } from 'lucide-react'
import type { NotebookResponse } from '@/lib/types/api'

const formatDate = (value: string, locale: 'zh' | 'en') => {
  const date = new Date(value)
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export default function KnowledgeBasesPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const { data: notebooks = [], isLoading } = useNotebooks()
  const createNotebook = useCreateNotebook()
  const deleteNotebook = useDeleteNotebook()

  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [notebookToDelete, setNotebookToDelete] = useState<NotebookResponse | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const filtered = notebooks

  const handleCreate = async () => {
    if (!title.trim()) return
    try {
      await createNotebook.mutateAsync({
        name: title.trim(),
        description: description.trim() || undefined,
      })
      setTitle('')
      setDescription('')
      setDialogOpen(false)
    } catch (error) {
      console.error('Failed to create notebook:', error)
    }
  }

  const handleDelete = () => {
    if (!notebookToDelete) return
    deleteNotebook.mutate(notebookToDelete.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false)
        setNotebookToDelete(null)
      }
    })
  }

  const openDeleteDialog = (e: React.MouseEvent, notebook: NotebookResponse) => {
    e.stopPropagation()
    setNotebookToDelete(notebook)
    setDeleteDialogOpen(true)
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <Layers className="h-3 w-3" />
                {t('nav.knowledgeBases')}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('nav.knowledgeBases')}
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                {t('hint.sources')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={viewMode}
                onValueChange={(value) => setViewMode(value as 'card' | 'list')}
              >
                <SelectTrigger
                  className="w-40 bg-card/70 border-border/60"
                  data-testid="view-select"
                >
                  <SelectValue placeholder={t('label.view')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card" data-testid="view-option-card">
                    <span className="inline-flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      {t('view.card')}
                    </span>
                  </SelectItem>
                  <SelectItem value="list" data-testid="view-option-list">
                    <span className="inline-flex items-center gap-2">
                      <List className="h-4 w-4 text-muted-foreground" />
                      {t('view.list')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('action.newKnowledgeBase')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-10 text-center text-sm text-muted-foreground">
              {t('status.processing')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FolderPlus className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">{t('empty.kb')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('hint.notes')}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            <div
              className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4"
              data-testid="notebook-list"
              data-view="card"
            >
              {filtered.map((kb) => {
                return (
                  <div
                    key={kb.id}
                    onClick={() => router.push(`/notebooks/${kb.id}`)}
                    className="group text-left rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm hover:shadow-lg transition-all cursor-pointer"
                    data-testid="notebook-card"
                    data-kb-id={kb.id}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {kb.name}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {kb.description || t('notebook.noDescription')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => openDeleteDialog(e, kb)}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          title={t('notebook.deleteTitle')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="rounded-full border border-border/60 p-2 text-muted-foreground group-hover:text-primary transition-colors">
                          <ArrowUpRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-muted px-2 py-1 text-foreground/80">
                        {t('label.sourcesCount', { count: kb.source_count })}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1 text-foreground/80">
                        {t('label.notesCount', { count: kb.note_count })}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1 text-foreground/60">
                        {t('label.updated')}: {formatDate(kb.updated, locale)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              className="rounded-2xl border border-border/70 bg-card/70 overflow-hidden"
              data-testid="notebook-list"
              data-view="list"
            >
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b border-border/60">
                <span>{t('label.title')}</span>
                <span>{t('section.sources')}</span>
                <span>{t('section.notes')}</span>
                <span>{t('label.updated')}</span>
                <span></span>
              </div>
              <div className="divide-y divide-border/60">
                {filtered.map((kb) => {
                  return (
                    <div
                      key={kb.id}
                      onClick={() => router.push(`/notebooks/${kb.id}`)}
                      className="group w-full text-left px-5 py-4 grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-4 hover:bg-muted/40 transition-colors items-center cursor-pointer"
                      data-testid="notebook-card"
                      data-kb-id={kb.id}
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {kb.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {kb.description || t('notebook.noDescription')}
                        </p>
                      </div>
                      <span className="text-sm text-foreground/80">{kb.source_count}</span>
                      <span className="text-sm text-foreground/80">{kb.note_count}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(kb.updated, locale)}
                      </span>
                      <button
                        onClick={(e) => openDeleteDialog(e, kb)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title={t('notebook.deleteTitle')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('action.newKnowledgeBase')}</DialogTitle>
            <DialogDescription>
              {t('hint.sources')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('label.title')}
              </label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('label.title')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('label.description')}
              </label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('label.description')}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!title.trim()}>
              {t('action.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('notebook.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('notebook.deleteDescription', { name: notebookToDelete?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteNotebook.isPending}>
              {deleteNotebook.isPending ? t('action.deleting') : t('action.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
