# 前端组件开发指南

> 基于实际项目代码的组件开发最佳实践

---

## 📚 目录

- [基础组件](#基础组件)
- [业务组件](#业务组件)
- [页面组件](#页面组件)
- [状态管理集成](#状态管理集成)
- [常见模式](#常见模式)

---

## 🎨 基础组件

### UI 组件 (components/ui/)

所有 UI 组件基于 Radix UI + Tailwind CSS。

#### 使用示例

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateItemDialog({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    try {
      await onCreate(name)
      setOpen(false)
      setName('')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
          <DialogDescription>
            Enter the name for the new item.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name..."
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
```

### 关键要点

✅ **必须**:
1. 使用 `@/components/ui/` 下的组件
2. 使用 `Label` + `htmlFor` 关联输入框
3. 使用 `disabled` 状态防止重复提交
4. 使用 `DialogFooter` 布局操作按钮
5. 清理状态 (`setName('')`) 当关闭时

---

## 💼 业务组件

### 卡片组件 (参考: [app/page.tsx](app/page.tsx))

```typescript
interface ItemCardProps {
  item: {
    id: string
    title: string
    description: string | null
    updated_at: string
    _count?: { documents: number }
  }
  onClick: () => void
  onDelete: () => void
}

export function ItemCard({ item, onClick, onDelete }: ItemCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
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
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

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
            {/* Icon */}
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5 text-primary" />
            </div>
            {/* Content */}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{item.title}</CardTitle>
              <CardDescription className="text-xs">
                {item._count?.documents || 0} documents
              </CardDescription>
            </div>
          </div>
          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick() }}>
                <FileText className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete() }} disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      {item.description && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        </CardContent>
      )}
      <CardContent className="pt-0">
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Updated {formatDate(item.updated_at)}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 关键要点

✅ **必须**:
1. **Props 接口定义**: 清晰的 TypeScript 类型
2. **Loading 状态**: 使用本地 `useState` 管理 loading
3. **确认对话框**: 删除操作需要用户确认
4. **事件冒泡控制**: 使用 `e.stopPropagation()` 防止触发父级点击
5. **条件渲染**: 使用 `&&` 和 `?.` 可选链
6. **日期格式化**: 相对时间 (Today, Yesterday, X days ago)
7. **文本截断**: 使用 `truncate`, `line-clamp-2` 等 utility classes

---

## 📄 页面组件

### 主页模板 (参考: [app/page.tsx](app/page.tsx))

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useKBStore, KnowledgeBase } from '@/lib/stores/kb-store'
import { knowledgeBaseApi } from '@/lib/api/knowledge-base'

export default function HomePage() {
  const router = useRouter()
  const {
    knowledgeBases,
    isLoading,
    error,
    setKnowledgeBases,
    addKnowledgeBase,
    setLoading,
    setError,
  } = useKBStore()

  const [searchQuery, setSearchQuery] = useState('')

  // 认证 + 数据加载
  useEffect(() => {
    checkAuth()
    fetchKnowledgeBases()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        router.push('/login')
      }
    } catch (error) {
      router.push('/login')
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

  const filteredKBs = knowledgeBases.filter((kb) =>
    kb.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Loading 状态
  if (isLoading && knowledgeBases.length === 0) {
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

  // Error 状态
  if (error) {
    return (
      <AppShell>
        <Card className="max-w-md mx-auto mt-8 border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  // 主内容
  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Knowledge Bases</h1>
            <p className="text-muted-foreground mt-1">
              Manage your knowledge bases and documents
            </p>
          </div>
          <CreateKBDialog onCreate={handleCreateKB} />
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Search knowledge bases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Grid */}
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
      </div>
    </AppShell>
  )
}
```

### 关键要点

✅ **必须**:
1. **认证检查**: 页面加载时验证用户登录状态
2. **状态管理**: 从 Zustand store 读取和更新状态
3. **API 调用**: 使用 `lib/api/` 下的 API 客户端
4. **错误处理**: try-catch + setError + console.error
5. **Loading 状态**: 显示加载动画
6. **搜索过滤**: 本地过滤 (简单场景)
7. **空状态**: EmptyState 组件
8. **响应式布局**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

## 🔄 状态管理集成

### 使用 Store

```typescript
import { useKBStore, KnowledgeBase } from '@/lib/stores/kb-store'

export function MyComponent() {
  // 1. 解构需要的状态和操作
  const {
    knowledgeBases,
    currentKB,
    isLoading,
    error,
    setCurrentKB,
    addKnowledgeBase,
    deleteKnowledgeBase,
  } = useKBStore()

  // 2. 使用状态
  if (isLoading) return <div>Loading...</div>

  // 3. 更新状态
  const handleSelect = (kb: KnowledgeBase) => {
    setCurrentKB(kb)
  }

  return (
    <div>
      {knowledgeBases.map((kb) => (
        <div key={kb.id} onClick={() => handleSelect(kb)}>
          {kb.title}
        </div>
      ))}
    </div>
  )
}
```

### Store 中的类型导出

```typescript
// lib/stores/kb-store.ts
import { create } from 'zustand'

// ✅ 导出类型供组件使用
export interface KnowledgeBase {
  id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
  document_count?: number
}

interface KBState {
  knowledgeBases: KnowledgeBase[]
  currentKB: KnowledgeBase | null
  // ...
}

export const useKBStore = create<KBState>((set) => ({
  // ...
}))

// ✅ 组件中导入
import { useKBStore, KnowledgeBase } from '@/lib/stores/kb-store'
```

---

## 🎯 常见模式

### 1. 表单处理

```typescript
export function MyForm() {
  const [values, setValues] = useState({ name: '', email: '' })
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!values.name) newErrors.name = 'Name is required'
    if (!values.email) newErrors.email = 'Email is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await api.submit(values)
      // success
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
```

### 2. 列表渲染 + Loading

```typescript
export function ItemList() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const data = await api.getItems()
      setItems(data)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  }

  if (items.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No items found</div>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  )
}
```

### 3. 确认删除

```typescript
export function DeleteButton({ onDelete, itemName }: { onDelete: () => void; itemName: string }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleClick = async () => {
    if (!confirm(`Are you sure you want to delete "${itemName}"?`)) {
      return
    }

    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button variant="destructive" onClick={handleClick} disabled={isDeleting}>
      {isDeleting ? 'Deleting...' : 'Delete'}
    </Button>
  )
}
```

### 4. 搜索过滤

```typescript
export function SearchableList({ items }: { items: Item[] }) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div>
      <Input
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-4"
      />
      {filteredItems.length === 0 ? (
        <p className="text-center text-muted-foreground">No results found</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div key={item.id}>{item.name}</div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## 📌 最佳实践总结

1. **类型安全**: 所有 Props 和状态都定义 TypeScript 接口
2. **错误处理**: try-catch + finally + setError
3. **Loading 状态**: 所有异步操作都有 loading 状态
4. **用户体验**: 确认删除、禁用按钮、显示错误
5. **代码组织**: 组件按功能分层 (ui/ layout/ chat/)
6. **状态管理**: 复杂状态用 Zustand，简单状态用 useState
7. **样式一致**: 使用 Tailwind 语义化变量
8. **路径别名**: 始终使用 `@/` 导入

---

**组件开发指南 v1.0.0** | 生成于 2025-01-14
