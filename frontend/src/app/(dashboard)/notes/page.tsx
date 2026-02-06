'use client'

import { useMemo, useRef, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { useMockStore } from '@/lib/mock/store'
import { StickyNote, PenLine, Layers } from 'lucide-react'

const formatDate = (value: string, locale: 'zh' | 'en') => {
  const date = new Date(value)
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export default function NotesPage() {
  const { t, locale } = useI18n()
  const {
    knowledgeBases,
    notes,
    addNote,
    updateNote,
    convertNoteToSource,
  } = useMockStore()

  const [search, setSearch] = useState('')
  const [filterKbId, setFilterKbId] = useState('all')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [newNoteKbId, setNewNoteKbId] = useState(
    knowledgeBases[0]?.id ?? ''
  )
  const [convertingNoteId, setConvertingNoteId] = useState<string | null>(null)
  const convertingNoteIdsRef = useRef<Set<string>>(new Set())

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return notes
      .filter((note) => (filterKbId === 'all' ? true : note.kbId === filterKbId))
      .filter((note) =>
        query
          ? note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query)
          : true
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [filterKbId, notes, search])

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null
    return notes.find((note) => note.id === selectedNoteId) ?? null
  }, [notes, selectedNoteId])

  const handleSelectNote = (noteId: string) => {
    const note = notes.find((entry) => entry.id === noteId)
    if (!note) return
    setSelectedNoteId(note.id)
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setNewNoteKbId(note.kbId)
  }

  const handleNewNote = () => {
    setSelectedNoteId(null)
    setNoteTitle('')
    setNoteContent('')
    if (filterKbId !== 'all') {
      setNewNoteKbId(filterKbId)
    }
  }

  const handleAddNote = () => {
    if (!noteContent.trim()) return
    const targetKbId =
      selectedNote?.kbId || newNoteKbId || knowledgeBases[0]?.id
    if (!targetKbId) return
    const title = noteTitle.trim() || t('label.title')
    const note = addNote(targetKbId, title, noteContent.trim())
    setSelectedNoteId(note.id)
  }

  const handleSaveNote = () => {
    if (!selectedNote) return
    updateNote(
      selectedNote.id,
      noteContent || selectedNote.content,
      noteTitle || selectedNote.title
    )
  }

  const handleConvertNote = () => {
    if (!selectedNote) return
    if (convertingNoteIdsRef.current.has(selectedNote.id)) return
    convertingNoteIdsRef.current.add(selectedNote.id)
    setConvertingNoteId(selectedNote.id)
    const currentNoteId = selectedNote.id
    try {
      convertNoteToSource(selectedNote.id)
    } finally {
      setTimeout(() => {
        convertingNoteIdsRef.current.delete(currentNoteId)
        setConvertingNoteId((prev) => (prev === currentNoteId ? null : prev))
      }, 0)
    }
  }

  const handleFilterChange = (value: string) => {
    setFilterKbId(value)
    if (value !== 'all' && !selectedNoteId) {
      setNewNoteKbId(value)
    }
    if (selectedNoteId && value !== 'all') {
      const note = notes.find((entry) => entry.id === selectedNoteId)
      if (note && note.kbId !== value) {
        setSelectedNoteId(null)
        setNoteTitle('')
        setNoteContent('')
        setNewNoteKbId(value)
      }
    }
  }

  const selectedKbName =
    knowledgeBases.find((kb) => kb.id === (selectedNote?.kbId || newNoteKbId))
      ?.title || t('label.kb')

  return (
    <AppShell>
      <div className="flex-1 overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <StickyNote className="h-3 w-3" />
                {t('nav.notes')}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('nav.notes')}
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                {t('hint.notes')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('label.searchNotes')}
                className="w-56 bg-card/70 border-border/60"
              />
              <Select value={filterKbId} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-52 bg-card/70 border-border/60">
                  <SelectValue placeholder={t('label.kb')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('label.allKnowledgeBases')}</SelectItem>
                  {knowledgeBases.map((kb) => (
                    <SelectItem key={kb.id} value={kb.id}>
                      {kb.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-6 min-h-[520px]">
            <section className="rounded-2xl border border-border/70 bg-card/70 p-5 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <StickyNote className="h-4 w-4 text-primary" />
                  {t('section.notes')}
                </div>
                <span className="text-xs text-muted-foreground">
                  {filteredNotes.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('hint.notes')}
              </p>

              <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-2">
                {filteredNotes.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                    {t('empty.note')}
                  </div>
                )}
                {filteredNotes.map((note) => {
                  const kbName =
                    knowledgeBases.find((kb) => kb.id === note.kbId)?.title ||
                    t('label.kb')
                  return (
                    <button
                      key={note.id}
                      onClick={() => handleSelectNote(note.id)}
                      className={`w-full text-left rounded-xl border border-border/60 px-3 py-2 text-sm transition-colors ${
                        selectedNote?.id === note.id
                          ? 'bg-primary/10 border-primary/40'
                          : 'bg-background/70 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{note.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {kbName}
                          </p>
                        </div>
                        {note.locked && (
                          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            {t('status.completed')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                        {note.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {t('label.updated')}: {formatDate(note.updatedAt, locale)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card/70 p-5 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PenLine className="h-4 w-4 text-primary" />
                  {selectedNote ? selectedNote.title : t('notes.selectHint')}
                </div>
                <Button variant="ghost" size="sm" onClick={handleNewNote}>
                  {t('action.newNote')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedNote?.locked ? t('notes.lockedHint') : t('hint.notes')}
              </p>

              <div className="mt-4 flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('label.kb')}
                  </label>
                  {selectedNote ? (
                    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedKbName}</span>
                    </div>
                  ) : (
                    <Select
                      value={newNoteKbId}
                      onValueChange={setNewNoteKbId}
                    >
                      <SelectTrigger className="w-full bg-card/70 border-border/60">
                        <SelectValue placeholder={t('label.kb')} />
                      </SelectTrigger>
                      <SelectContent>
                        {knowledgeBases.map((kb) => (
                          <SelectItem key={kb.id} value={kb.id}>
                            {kb.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('label.title')}
                  </label>
                  <Input
                    value={noteTitle}
                    onChange={(event) => setNoteTitle(event.target.value)}
                    disabled={selectedNote?.locked}
                  />
                </div>

                <div className="space-y-2 flex-1 flex flex-col">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('label.content')}
                  </label>
                  <Textarea
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    rows={8}
                    className="flex-1"
                    disabled={selectedNote?.locked}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={handleAddNote}
                  disabled={!noteContent.trim() || !newNoteKbId || !!selectedNote?.locked}
                >
                  {t('action.addNote')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveNote}
                  disabled={!selectedNote || selectedNote.locked}
                >
                  {t('action.saveNote')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleConvertNote}
                  disabled={!selectedNote || selectedNote.locked || convertingNoteId === selectedNote.id}
                >
                  {t('action.convertToSource')}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
