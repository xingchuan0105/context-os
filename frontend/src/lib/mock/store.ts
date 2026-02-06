import { create } from 'zustand'

export type SourceStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface MockKnowledgeBase {
  id: string
  title: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface MockSource {
  id: string
  kbId: string
  title: string
  status: SourceStatus
  progress: number
  sizeLabel: string
  createdAt: string
  updatedAt: string
  fromNoteId?: string
  fromQuickNoteId?: string
  sourceType?: 'file' | 'url' | 'paste' | 'quickNote' | 'note'
}

export interface MockNote {
  id: string
  kbId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  locked: boolean
  sourceId?: string
}

export interface MockChatMessage {
  id: string
  kbId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface MockQuickNote {
  id: string
  label: string
  content: string
  preview: string
  createdAt: string
  updatedAt: string
}

export interface MockShareLink {
  id: string
  kbId: string
  token: string
  permission: 'chat'
  expiresAt: string | null
  createdAt: string
  revokedAt?: string | null
}

interface MockState {
  knowledgeBases: MockKnowledgeBase[]
  sources: MockSource[]
  notes: MockNote[]
  chats: Record<string, MockChatMessage[]>
  shares: MockShareLink[]
  quickNotes: MockQuickNote[]
  createKnowledgeBase: (title: string, description?: string) => MockKnowledgeBase
  addSource: (
    kbId: string,
    title: string,
    sizeLabel?: string,
    options?: {
      fromNoteId?: string
      fromQuickNoteId?: string
      sourceType?: MockSource['sourceType']
    }
  ) => MockSource
  updateSourceStatus: (sourceId: string, status: SourceStatus, progress?: number) => void
  removeSource: (sourceId: string) => void
  addNote: (kbId: string, title: string, content: string) => MockNote
  updateNote: (noteId: string, content: string, title?: string) => void
  convertNoteToSource: (noteId: string) => MockSource | null
  sendChatMessage: (
    kbId: string,
    message: string,
    locale: 'zh' | 'en',
    selectedSources?: string[]
  ) => void
  saveAnswerToNote: (kbId: string, content: string) => MockNote
  createShareLink: (kbId: string, expiresAt: string | null) => MockShareLink
  revokeShareLink: (shareId: string) => void
  saveQuickNote: (label: string, content: string, locale?: 'zh' | 'en') => MockQuickNote
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id_${Math.random().toString(36).slice(2, 10)}`
}

const now = () => new Date().toISOString()

const seedKnowledgeBases: MockKnowledgeBase[] = [
  {
    id: 'kb-core-research',
    title: 'Core Research',
    description: 'Long-term research threads and foundational sources.',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'kb-product-intel',
    title: 'Product Intel',
    description: 'Competitive intel, launch notes, and field insights.',
    createdAt: now(),
    updatedAt: now(),
  },
]

const seedSources: MockSource[] = [
  {
    id: 'src-vision-brief',
    kbId: 'kb-core-research',
    title: 'Vision Brief 2026.pdf',
    status: 'completed',
    progress: 100,
    sizeLabel: '2.3 MB',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'src-competitor-notes',
    kbId: 'kb-product-intel',
    title: 'Competitor Notes.md',
    status: 'completed',
    progress: 100,
    sizeLabel: '128 KB',
    createdAt: now(),
    updatedAt: now(),
  },
]

const seedNotes: MockNote[] = [
  {
    id: 'note-kb-core-1',
    kbId: 'kb-core-research',
    title: 'Frontier hypotheses',
    content: 'Capture early hypotheses here. This will be refined after source ingestion.',
    createdAt: now(),
    updatedAt: now(),
    locked: false,
  },
]

const buildQuickNotePreview = (content: string, locale: 'zh' | 'en') => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('时间') && !line.startsWith('Time'))
    .map((line) => line.replace(/^\[(User|AI)\]\s*/i, ''))

  const preview = lines.join(' ')
  const maxLength = locale === 'zh' ? 120 : 180
  return preview.length > maxLength ? `${preview.slice(0, maxLength)}...` : preview
}

const buildQuickNoteContent = (label: string, body: string, locale: 'zh' | 'en') => {
  const titlePrefix = locale === 'zh' ? '随手记' : 'Quick Note'
  const timeLabel = locale === 'zh' ? '时间' : 'Time'
  const dialogueLabel = locale === 'zh' ? '对话' : 'Dialogue'
  return [
    `# ${titlePrefix} · ${label}`,
    `${timeLabel}：${new Date().toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}`,
    '',
    `## ${dialogueLabel}`,
    '',
    body,
  ].join('\n')
}

const seedQuickNotes: MockQuickNote[] = [
  {
    id: 'quick-001',
    label: 'Prototype flow',
    content: buildQuickNoteContent(
      'Prototype flow',
      '[User] Explore a split-pane flow for notebook context + chat + notes.\n\n[AI] Are you prioritizing the source column or the chat column first?',
      'en'
    ),
    preview: '',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'quick-002',
    label: 'Signal capture',
    content: buildQuickNoteContent(
      'Signal capture',
      '[User] Save key signals quickly, convert to sources when stable.\n\n[AI] What makes a signal “stable” in your workflow?',
      'en'
    ),
    preview: '',
    createdAt: now(),
    updatedAt: now(),
  },
].map((note) => ({
  ...note,
  preview: buildQuickNotePreview(note.content, 'en'),
}))

const processingTimers = new Map<string, ReturnType<typeof setTimeout>>()

const simulateProcessing = (
  sourceId: string,
  updateSourceStatus: (id: string, status: SourceStatus, progress: number) => void
) => {
  if (processingTimers.has(sourceId)) {
    return
  }

  const steps = [10, 35, 60, 85, 100]
  const runStep = (index: number) => {
    if (index === 0) {
      updateSourceStatus(sourceId, 'processing', steps[index])
    } else if (index < steps.length - 1) {
      updateSourceStatus(sourceId, 'processing', steps[index])
    } else {
      updateSourceStatus(sourceId, 'completed', steps[index])
      processingTimers.delete(sourceId)
      return
    }

    const handle = setTimeout(() => runStep(index + 1), 700 + Math.random() * 600)
    processingTimers.set(sourceId, handle)
  }

  const handle = setTimeout(() => runStep(0), 600)
  processingTimers.set(sourceId, handle)
}

export const useMockStore = create<MockState>((set, get) => ({
  knowledgeBases: seedKnowledgeBases,
  sources: seedSources,
  notes: seedNotes,
  chats: {},
  shares: [],
  quickNotes: seedQuickNotes,

  createKnowledgeBase: (title, description) => {
    const kb: MockKnowledgeBase = {
      id: createId(),
      title,
      description,
      createdAt: now(),
      updatedAt: now(),
    }

    set((state) => ({
      knowledgeBases: [kb, ...state.knowledgeBases],
    }))
    return kb
  },

  addSource: (kbId, title, sizeLabel = '512 KB', options) => {
    const source: MockSource = {
      id: createId(),
      kbId,
      title,
      status: 'queued',
      progress: 0,
      sizeLabel,
      createdAt: now(),
      updatedAt: now(),
      fromNoteId: options?.fromNoteId,
      fromQuickNoteId: options?.fromQuickNoteId,
      sourceType: options?.sourceType,
    }

    set((state) => ({
      sources: [source, ...state.sources],
      knowledgeBases: state.knowledgeBases.map((kb) =>
        kb.id === kbId ? { ...kb, updatedAt: now() } : kb
      ),
    }))

    simulateProcessing(source.id, (id, status, progress) => {
      get().updateSourceStatus(id, status, progress)
    })

    return source
  },

  updateSourceStatus: (sourceId, status, progress = 0) => {
    set((state) => ({
      sources: state.sources.map((source) =>
        source.id === sourceId
          ? {
              ...source,
              status,
              progress,
              updatedAt: now(),
            }
          : source
      ),
    }))
  },

  removeSource: (sourceId) => {
    set((state) => ({
      sources: state.sources.filter((source) => source.id !== sourceId),
    }))
  },

  addNote: (kbId, title, content) => {
    const note: MockNote = {
      id: createId(),
      kbId,
      title,
      content,
      createdAt: now(),
      updatedAt: now(),
      locked: false,
    }

    set((state) => ({
      notes: [note, ...state.notes],
      knowledgeBases: state.knowledgeBases.map((kb) =>
        kb.id === kbId ? { ...kb, updatedAt: now() } : kb
      ),
    }))

    return note
  },

  updateNote: (noteId, content, title) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId || note.locked) {
          return note
        }
        return {
          ...note,
          content,
          title: title ?? note.title,
          updatedAt: now(),
        }
      }),
    }))
  },

  convertNoteToSource: (noteId) => {
    const { notes } = get()
    const note = notes.find((entry) => entry.id === noteId)
    if (!note || note.locked) {
      return null
    }

    const source = get().addSource(
      note.kbId,
      `${note.title || 'Untitled Note'}.md`,
      '64 KB',
      { fromNoteId: noteId, sourceType: 'note' }
    )

    set((state) => ({
      notes: state.notes.map((entry) =>
        entry.id === noteId
          ? {
              ...entry,
              locked: true,
              sourceId: source.id,
              updatedAt: now(),
            }
          : entry
      ),
    }))

    return source
  },

  sendChatMessage: (kbId, message, locale, selectedSources) => {
    const userMessage: MockChatMessage = {
      id: createId(),
      kbId,
      role: 'user',
      content: message,
      createdAt: now(),
    }

    set((state) => ({
      chats: {
        ...state.chats,
        [kbId]: [...(state.chats[kbId] ?? []), userMessage],
      },
    }))

    const sourceCount = selectedSources?.length ?? 0
    const sourceHint = locale === 'zh'
      ? `已检索 ${sourceCount} 个源。`
      : `Using ${sourceCount} sources.`
    const response = locale === 'zh'
      ? `已收到你的问题：“${message}”。${sourceHint}我会结合当前笔记本的源与笔记给出重点结论。`
      : `Got it: "${message}". ${sourceHint}I will synthesize sources and notes to deliver the key points.`

    setTimeout(() => {
      const aiMessage: MockChatMessage = {
        id: createId(),
        kbId,
        role: 'assistant',
        content: response,
        createdAt: now(),
      }
      set((state) => ({
        chats: {
          ...state.chats,
          [kbId]: [...(state.chats[kbId] ?? []), aiMessage],
        },
      }))
    }, 800)
  },

  saveAnswerToNote: (kbId, content) => {
    const title = content.split('\n')[0]?.slice(0, 32) || 'Chat Answer'
    return get().addNote(kbId, title, content)
  },

  createShareLink: (kbId, expiresAt) => {
    const share: MockShareLink = {
      id: createId(),
      kbId,
      token: Math.random().toString(36).slice(2, 10),
      permission: 'chat',
      expiresAt,
      createdAt: now(),
      revokedAt: null,
    }

    set((state) => ({
      shares: [share, ...state.shares],
    }))

    return share
  },

  revokeShareLink: (shareId) => {
    set((state) => ({
      shares: state.shares.map((share) =>
        share.id === shareId
          ? { ...share, revokedAt: now() }
          : share
      ),
    }))
  },

  saveQuickNote: (label, content, locale = 'zh') => {
    const resolvedLabel = label.trim() || (locale === 'zh' ? '未命名随手记' : 'Untitled Quick Note')
    const resolvedContent = content.trim()
    const timestamp = now()
    const note: MockQuickNote = {
      id: createId(),
      label: resolvedLabel,
      content: resolvedContent,
      preview: buildQuickNotePreview(resolvedContent, locale),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    set((state) => ({
      quickNotes: [note, ...state.quickNotes],
    }))

    return note
  },
}))
