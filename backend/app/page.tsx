'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKBStore, KnowledgeBase } from '@/lib/stores/kb-store'

interface ExtendedKnowledgeBase extends KnowledgeBase {
  _count?: {
    documents?: number
  }
}
import { knowledgeBaseApi } from '@/lib/api/knowledge-base'
import {
  Plus,
  MoreVertical,
  FileText,
  Clock,
  Trash2,
  Search,
  Database,
  Sparkles,
} from 'lucide-react'

function CreateKBDialog({
  onCreate,
}: {
  onCreate: (name: string, description: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    try {
      await onCreate(name, description)
      setOpen(false)
      setName('')
      setDescription('')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Knowledge Base
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Knowledge Base</DialogTitle>
          <DialogDescription>
            Create a new knowledge base to organize your documents and enable intelligent search.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="kb-name">Name</Label>
            <Input
              id="kb-name"
              placeholder="e.g., Research Papers, Project Docs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-description">Description (optional)</Label>
            <Input
              id="kb-description"
              placeholder="A brief description of this knowledge base"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KBCard({
  kb,
  onClick,
  onDelete,
}: {
  kb: ExtendedKnowledgeBase
  onClick: () => void
  onDelete: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${kb.title}"? This will also delete all documents in this knowledge base.`)) {
      setIsDeleting(true)
      try {
        await onDelete()
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Just now'
    }

    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0" onClick={onClick}>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{kb.title}</CardTitle>
              <CardDescription className="text-xs">
                {kb._count?.documents || 0} {kb._count?.documents === 1 ? 'document' : 'documents'}
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick() }}>
                <FileText className="h-4 w-4 mr-2" />
                View Documents
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete() }} disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      {kb.description && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2">{kb.description}</p>
        </CardContent>
      )}
      <CardContent className="pt-0">
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Updated {formatDate(kb.updated_at)}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Database className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Knowledge Bases Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Create your first knowledge base to start organizing your documents with AI-powered cognitive analysis.
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4 mr-2" />
        Create Knowledge Base
      </Button>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const {
    knowledgeBases,
    isLoading,
    error,
    setKnowledgeBases,
    addKnowledgeBase,
    deleteKnowledgeBase,
    setLoading,
    setError,
  } = useKBStore()

  const [searchQuery, setSearchQuery] = useState('')
  const mountedRef = useRef(false)

  // Check if user is authenticated and fetch knowledge bases on mount
  useEffect(() => {
    mountedRef.current = true
    checkAuth()
    fetchKnowledgeBases()

    return () => {
      mountedRef.current = false
    }
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok && mountedRef.current) {
        router.push('/login')
      }
    } catch (error) {
      if (mountedRef.current) {
        router.push('/login')
      }
    }
  }

  const fetchKnowledgeBases = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await knowledgeBaseApi.getAll()
      setKnowledgeBases(data)
    } catch (error) {
      console.error('Failed to fetch knowledge bases:', error)
      setError('Failed to load knowledge bases')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKB = async (name: string, description: string) => {
    try {
      const newKB = await knowledgeBaseApi.create({ title: name, description })
      addKnowledgeBase(newKB)
    } catch (error) {
      console.error('Failed to create knowledge base:', error)
      throw error
    }
  }

  const handleDeleteKB = async (id: string) => {
    try {
      await knowledgeBaseApi.delete(id)
      deleteKnowledgeBase(id)
    } catch (error) {
      console.error('Failed to delete knowledge base:', error)
      throw error
    }
  }

  const filteredKBs = (knowledgeBases || []).filter((kb) =>
    kb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (kb.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  if (isLoading && (knowledgeBases || []).length === 0) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading knowledge bases...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              Knowledge Bases
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your knowledge bases and documents
            </p>
          </div>
          <CreateKBDialog onCreate={handleCreateKB} />
        </div>

        {/* Search */}
        {knowledgeBases.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search knowledge bases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 max-w-md"
              />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Knowledge Bases Grid */}
        {filteredKBs.length === 0 ? (
          searchQuery ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">No knowledge bases match your search.</p>
              </CardContent>
            </Card>
          ) : (
            <EmptyState onCreateClick={() => {}} />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredKBs.map((kb) => (
              <KBCard
                key={kb.id}
                kb={kb}
                onClick={() => router.push(`/kb/${kb.id}`)}
                onDelete={() => handleDeleteKB(kb.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
