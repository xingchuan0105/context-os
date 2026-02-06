'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateDialogs } from '@/lib/hooks/use-create-dialogs'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { useTheme } from '@/lib/stores/theme-store'
import { useI18n } from '@/lib/i18n'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Book,
  Search,
  Mic,
  Bot,
  Shuffle,
  Settings,
  FileText,
  Wrench,
  MessageCircleQuestion,
  Plus,
  Sun,
  Moon,
  Monitor,
  Loader2,
} from 'lucide-react'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { t, locale } = useI18n()
  const { openSourceDialog, openNotebookDialog, openPodcastDialog } = useCreateDialogs()
  const { setTheme } = useTheme()
  const { data: notebooks, isLoading: notebooksLoading } = useNotebooks(false)

  const navigationItems = useMemo(() => {
    const sourceKeywords = locale === 'zh'
      ? ['源', '文件', '文档', '上传', 'source', 'file', 'document', 'upload']
      : ['files', 'documents', 'upload']
    const notebookKeywords = locale === 'zh'
      ? ['笔记', '研究', '项目', 'note', 'research', 'project']
      : ['notes', 'research', 'projects']
    const searchKeywords = locale === 'zh'
      ? ['搜索', '提问', '查找', 'search', 'ask', 'query']
      : ['find', 'query']
    const podcastKeywords = locale === 'zh'
      ? ['播客', '音频', '节目', 'podcast', 'audio', 'episode']
      : ['audio', 'episodes', 'generate']
    const modelKeywords = locale === 'zh'
      ? ['模型', '提供方', 'ai', 'llm', 'openai', 'anthropic']
      : ['ai', 'llm', 'providers', 'openai', 'anthropic']
    const transformationKeywords = locale === 'zh'
      ? ['转换', '提示', '模板', 'prompt', 'template', 'action']
      : ['prompts', 'templates', 'actions']
    const settingsKeywords = locale === 'zh'
      ? ['设置', '偏好', '配置', 'settings', 'config']
      : ['preferences', 'config', 'options']
    const advancedKeywords = locale === 'zh'
      ? ['高级', '调试', '系统', 'advanced', 'debug', 'system']
      : ['debug', 'system', 'tools']

    return [
      { name: t('nav.sources'), href: '/sources', icon: FileText, keywords: sourceKeywords },
      { name: t('nav.notebooks'), href: '/notebooks', icon: Book, keywords: notebookKeywords },
      { name: t('nav.search'), href: '/search', icon: Search, keywords: searchKeywords },
      { name: t('nav.podcasts'), href: '/podcasts', icon: Mic, keywords: podcastKeywords },
      { name: t('nav.models'), href: '/models', icon: Bot, keywords: modelKeywords },
      { name: t('nav.transformations'), href: '/transformations', icon: Shuffle, keywords: transformationKeywords },
      { name: t('nav.settings'), href: '/settings', icon: Settings, keywords: settingsKeywords },
      { name: t('nav.advanced'), href: '/advanced', icon: Wrench, keywords: advancedKeywords },
    ]
  }, [t, locale])

  const createItems = useMemo(() => ([
    { name: t('action.createSource'), action: 'source', icon: FileText },
    { name: t('action.createNotebook'), action: 'notebook', icon: Book },
    { name: t('action.createPodcast'), action: 'podcast', icon: Mic },
  ]), [t])

  const themeItems = useMemo(() => {
    const lightKeywords = locale === 'zh' ? ['浅色', '白天', 'light', 'day'] : ['bright', 'day']
    const darkKeywords = locale === 'zh' ? ['深色', '夜间', 'dark', 'night'] : ['night']
    const systemKeywords = locale === 'zh' ? ['系统', '自动', 'system', 'auto'] : ['auto', 'default']
    return [
      { name: t('theme.light'), value: 'light' as const, icon: Sun, keywords: lightKeywords },
      { name: t('theme.dark'), value: 'dark' as const, icon: Moon, keywords: darkKeywords },
      { name: t('theme.system'), value: 'system' as const, icon: Monitor, keywords: systemKeywords },
    ]
  }, [t, locale])

  // Global keyboard listener for ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Skip if focus is inside editable elements
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        setOpen((open) => !open)
      }
    }

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', down, true)
    return () => document.removeEventListener('keydown', down, true)
  }, [])

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  const handleSelect = useCallback((callback: () => void) => {
    setOpen(false)
    setQuery('')
    // Use setTimeout to ensure dialog closes before action
    setTimeout(callback, 0)
  }, [])

  const handleNavigate = useCallback((href: string) => {
    handleSelect(() => router.push(href))
  }, [handleSelect, router])

  const handleSearch = useCallback(() => {
    if (!query.trim()) return
    handleSelect(() => router.push(`/search?q=${encodeURIComponent(query)}&mode=search`))
  }, [handleSelect, router, query])

  const handleAsk = useCallback(() => {
    if (!query.trim()) return
    handleSelect(() => router.push(`/search?q=${encodeURIComponent(query)}&mode=ask`))
  }, [handleSelect, router, query])

  const handleCreate = useCallback((action: string) => {
    handleSelect(() => {
      if (action === 'source') openSourceDialog()
      else if (action === 'notebook') openNotebookDialog()
      else if (action === 'podcast') openPodcastDialog()
    })
  }, [handleSelect, openSourceDialog, openNotebookDialog, openPodcastDialog])

  const handleTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    handleSelect(() => setTheme(theme))
  }, [handleSelect, setTheme])

  // Check if query matches any command (navigation, create, theme, or notebook)
  const queryLower = query.toLowerCase().trim()
  const hasCommandMatch = useMemo(() => {
    if (!queryLower) return false
    return (
      navigationItems.some(item =>
        item.name.toLowerCase().includes(queryLower) ||
        item.keywords.some(k => k.includes(queryLower))
      ) ||
      createItems.some(item =>
        item.name.toLowerCase().includes(queryLower)
      ) ||
      themeItems.some(item =>
        item.name.toLowerCase().includes(queryLower) ||
        item.keywords.some(k => k.includes(queryLower))
      ) ||
      (notebooks?.some(nb =>
        nb.name.toLowerCase().includes(queryLower) ||
        (nb.description && nb.description.toLowerCase().includes(queryLower))
      ) ?? false)
    )
  }, [queryLower, notebooks])

  // Determine if we should show the Search/Ask section at the top
  const showSearchFirst = query.trim() && !hasCommandMatch

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('command.title')}
      description={t('command.description')}
      className="sm:max-w-lg"
    >
      <CommandInput
        placeholder={t('command.placeholder')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Search/Ask - show FIRST when there's a query with no command match */}
        {showSearchFirst && (
          <CommandGroup heading={t('command.section.searchAsk')} forceMount>
            <CommandItem
              value={`__search__ ${query}`}
              onSelect={handleSearch}
              forceMount
            >
              <Search className="h-4 w-4" />
              <span>{t('command.searchFor', { query })}</span>
            </CommandItem>
            <CommandItem
              value={`__ask__ ${query}`}
              onSelect={handleAsk}
              forceMount
            >
              <MessageCircleQuestion className="h-4 w-4" />
              <span>{t('command.askAbout', { query })}</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Navigation */}
        <CommandGroup heading={t('command.section.navigation')}>
          {navigationItems.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.name} ${item.keywords.join(' ')}`}
              onSelect={() => handleNavigate(item.href)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Notebooks */}
        <CommandGroup heading={t('command.section.notebooks')}>
          {notebooksLoading ? (
            <CommandItem disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('command.loadingNotebooks')}</span>
            </CommandItem>
          ) : notebooks && notebooks.length > 0 ? (
            notebooks.map((notebook) => (
              <CommandItem
                key={notebook.id}
                value={`notebook ${notebook.name} ${notebook.description || ''}`}
                onSelect={() => handleNavigate(`/notebooks/${notebook.id}`)}
              >
                <Book className="h-4 w-4" />
                <span>{notebook.name}</span>
              </CommandItem>
            ))
          ) : null}
        </CommandGroup>

        {/* Create */}
        <CommandGroup heading={t('command.section.create')}>
          {createItems.map((item) => (
            <CommandItem
              key={item.action}
              value={`create ${item.name}`}
              onSelect={() => handleCreate(item.action)}
            >
              <Plus className="h-4 w-4" />
              <span>{item.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Theme */}
        <CommandGroup heading={t('command.section.theme')}>
          {themeItems.map((item) => (
            <CommandItem
              key={item.value}
              value={`theme ${item.name} ${item.keywords.join(' ')}`}
              onSelect={() => handleTheme(item.value)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Search/Ask - show at bottom when there IS a command match */}
        {query.trim() && hasCommandMatch && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('command.section.orSearch')} forceMount>
              <CommandItem
                value={`__search__ ${query}`}
                onSelect={handleSearch}
                forceMount
              >
                <Search className="h-4 w-4" />
                <span>{t('command.searchFor', { query })}</span>
              </CommandItem>
              <CommandItem
                value={`__ask__ ${query}`}
                onSelect={handleAsk}
                forceMount
              >
                <MessageCircleQuestion className="h-4 w-4" />
                <span>{t('command.askAbout', { query })}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
