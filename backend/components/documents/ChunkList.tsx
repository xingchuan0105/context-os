'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, LoadingState } from '@/components/ui/state'
import {
  FileText,
  Search,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

type ChunkFilterType = 'all' | 'parent' | 'child'
type ChunkSortBy = 'index' | 'score'

interface Chunk {
  id: string
  content: string
  score: number
  index: number
  type: 'parent' | 'child'
  parentId?: string
}

interface ChunkListProps {
  kbId: string
  docId: string
}

export function ChunkList({ kbId, docId }: ChunkListProps) {
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<ChunkSortBy>('index')
  const [filterType, setFilterType] = useState<ChunkFilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set())

  // 获取文档的 chunks
  useEffect(() => {
    const fetchChunks = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // TODO: 实现获取 chunks 的 API
        // const data = await documentApi.getChunks(kbId, docId)
        // 模拟数据
        const mockChunks: Chunk[] = [
          {
            id: '1',
            content: '这是第一个父块的内容，包含了文档的主要章节信息。',
            score: 0.95,
            index: 0,
            type: 'parent',
          },
          {
            id: '2',
            content: '这是第一个子块，详细描述了章节中的具体内容。',
            score: 0.88,
            index: 1,
            type: 'child',
            parentId: '1',
          },
          {
            id: '3',
            content: '这是第二个子块，进一步展开说明了相关的概念。',
            score: 0.82,
            index: 2,
            type: 'child',
            parentId: '1',
          },
        ]

        setChunks(mockChunks)
      } catch (error: unknown) {
        console.error('Failed to fetch chunks:', error)
        setError(error instanceof Error ? error.message : '加载失败')
      } finally {
        setIsLoading(false)
      }
    }

    fetchChunks()
  }, [kbId, docId])

  // 切换展开/折叠
  const toggleExpand = (chunkId: string) => {
    const newExpanded = new Set(expandedChunks)
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId)
    } else {
      newExpanded.add(chunkId)
    }
    setExpandedChunks(newExpanded)
  }

  // 过滤和排序 chunks
  const filteredChunks = chunks
    .filter((chunk) => {
      // 类型过滤
      if (filterType !== 'all' && chunk.type !== filterType) return false

      // 搜索过滤
      if (searchQuery && !chunk.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      if (sortBy === 'index') return a.index - b.index
      return b.score - a.score
    })

  // 格式化评分
  const formatScore = (score: number) => {
    return Math.round(score * 100)
  }

  // 获取评分颜色
  const getScoreColor = (score: number) => {
    const percentage = formatScore(score)
    if (percentage >= 80) return 'text-green-600 bg-green-50'
    if (percentage >= 60) return 'text-blue-600 bg-blue-50'
    if (percentage >= 40) return 'text-yellow-600 bg-yellow-50'
    return 'text-gray-600 bg-gray-50'
  }

  if (isLoading) {
    return <LoadingState title="加载内容块..." className="py-16" />
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (filteredChunks.length === 0) {
    return (
      <EmptyState
        title="没有找到匹配的内容块"
        description="尝试调整搜索条件或过滤器"
        icon={FileText}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            内容块 ({filteredChunks.length})
          </CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="搜索内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 h-8"
            />
            <Select value={filterType} onValueChange={(v) => setFilterType(v as ChunkFilterType)}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="parent">父块</SelectItem>
                <SelectItem value="child">子块</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as ChunkSortBy)}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="index">按序号</SelectItem>
                <SelectItem value="score">按相关度</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredChunks.map((chunk) => (
            <Card
              key={chunk.id}
              className={`transition-all ${
                chunk.type === 'child' ? 'ml-6 border-l-4 border-l-primary/20' : ''
              }`}
            >
              <CardHeader
                className="pb-3 cursor-pointer select-none"
                onClick={() => toggleExpand(chunk.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {chunk.type === 'parent' ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                <CardTitle className="text-sm">
                  {chunk.type === 'parent' ? '父块' : '子块'} #{chunk.index + 1}
                </CardTitle>
                <Badge variant="outline" className="shrink-0">
                  {chunk.type}
                </Badge>
              </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 ${getScoreColor(chunk.score)}`}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {formatScore(chunk.score)}%
                  </Badge>
                </div>
              </CardHeader>
              {expandedChunks.has(chunk.id) && (
                <CardContent className="pt-0">
                  <ScrollArea className="h-[100px]">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {chunk.content}
                    </p>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
