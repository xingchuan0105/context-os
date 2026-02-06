'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { EmptyState, LoadingState } from '@/components/ui/state'
import {
  Search,
  FileText,
  Loader2,
  TrendingUp,
  Clock,
  Filter,
  X,
} from 'lucide-react'
import { useKBStore } from '@/lib/stores/kb-store'
import { knowledgeBaseApi } from '@/lib/api/knowledge-base'

type SearchMode = 'drill-down' | 'flat'
type SortBy = 'score' | 'time'

interface SearchResult {
  content: string
  score: number
  docId: string
  kbId: string
  type: string
  parentContent: string | null
  metadata: {
    file_name?: string
    chunk_index?: number
  }
}

interface SearchResponse {
  mode: string
  results: SearchResult[]
  query: string
  total: number
}

interface SearchRequestBody {
  query: string
  mode: string
  topK: number
  scoreThreshold: number
  kbId?: string
}

// 防抖 Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { knowledgeBases, setCurrentKB } = useKBStore()

  // 状态
  const [query, setQuery] = useState('')
  const [selectedKB, setSelectedKB] = useState<string>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<SearchMode>('flat')
  const [sortBy, setSortBy] = useState<SortBy>('score')

  const debouncedQuery = useDebounce(query, 300)

  // 获取知识库列表
  useEffect(() => {
    const fetchKBs = async () => {
      try {
        const data = await knowledgeBaseApi.getAll()
        knowledgeBases.length === 0 && data.forEach(kb => knowledgeBases.push(kb))
      } catch (error) {
        console.error('Failed to fetch knowledge bases:', error)
      }
    }
    fetchKBs()
  }, [])

  // 执行搜索
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const requestBody: SearchRequestBody = {
        query: searchQuery,
        mode: searchMode,
        topK: 20,
        scoreThreshold: 0.3,
      }

      if (selectedKB !== 'all') {
        requestBody.kbId = selectedKB
      }

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        throw new Error('搜索失败')
      }

      const data: SearchResponse = await res.json()

      // 排序结果
      let sortedResults = [...data.results]
      if (sortBy === 'score') {
        sortedResults.sort((a, b) => b.score - a.score)
      }

      setResults(sortedResults)
    } catch (error: unknown) {
      console.error('Search failed:', error)
      const errorMessage = error instanceof Error ? error.message : '搜索失败，请重试'
      setError(errorMessage)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedKB, searchMode, sortBy])

  // 当防抖后的查询改变时执行搜索
  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery)
    } else {
      setResults([])
    }
  }, [debouncedQuery, performSearch])

  // 清空搜索
  const clearSearch = () => {
    setQuery('')
    setResults([])
    setError(null)
  }

  // 格式化相关性评分
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

  // 跳转到文档详情
  const viewDocument = (kbId: string, docId: string) => {
    setCurrentKB(knowledgeBases.find(kb => kb.id === kbId) || null)
    router.push(`/kb/${kbId}/doc/${docId}`)
  }

  // 高亮搜索关键词
  const highlightQuery = (text: string, query: string) => {
    if (!query) return text

    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Search className="h-7 w-7 text-primary" />
            语义搜索
          </h1>
          <p className="text-muted-foreground mt-1">
            在您的文档中进行智能语义搜索
          </p>
        </div>

        {/* 搜索栏 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* 主搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="输入关键词或问题..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {query && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* 过滤器 */}
              <div className="flex flex-wrap gap-4">
                {/* 知识库选择 */}
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">知识库</Label>
                  <Select value={selectedKB} onValueChange={setSelectedKB}>
                    <SelectTrigger>
                      <SelectValue placeholder="所有知识库" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有知识库</SelectItem>
                      {knowledgeBases.map((kb) => (
                        <SelectItem key={kb.id} value={kb.id}>
                          {kb.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 搜索模式 */}
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">搜索模式</Label>
                  <Select value={searchMode} onValueChange={(v) => setSearchMode(v as SearchMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">平面搜索</SelectItem>
                      <SelectItem value="drill-down">三层检索</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 排序方式 */}
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">排序方式</Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">按相关性</SelectItem>
                      <SelectItem value="time">按时间</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 快速统计 */}
              {query && !isLoading && results.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  找到 <span className="font-semibold text-foreground">{results.length}</span> 个结果
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <LoadingState
            title="搜索中..."
            description="正在分析您的查询并检索相关内容"
            className="max-w-sm mx-auto"
          />
        )}

        {/* 空状态 */}
        {!query && !isLoading && (
          <EmptyState
            title="开始搜索"
            description="输入关键词或问题，在您的文档中进行智能语义搜索"
            icon={Search}
            className="py-16"
          />
        )}

        {!isLoading && query && results.length === 0 && (
          <EmptyState
            title="未找到相关内容"
            description="尝试使用不同的关键词或扩大搜索范围"
            icon={FileText}
            className="py-16"
          />
        )}

        {/* 搜索结果 */}
        {!isLoading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((result, index) => (
              <Card
                key={`${result.docId}-${index}`}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => viewDocument(result.kbId, result.docId)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {result.metadata?.file_name || '文档'}
                        </span>
                      </CardTitle>
                      {result.metadata?.chunk_index !== undefined && (
                        <CardDescription className="text-xs">
                          Chunk {result.metadata.chunk_index + 1}
                        </CardDescription>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 ${getScoreColor(result.score)}`}
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {formatScore(result.score)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[100px]">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {highlightQuery(result.content, query)}
                    </p>
                  </ScrollArea>
                  {result.parentContent && (
                    <details className="mt-3">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        查看上下文
                      </summary>
                      <p className="mt-2 text-xs text-muted-foreground pl-3 border-l-2 border-muted">
                        {result.parentContent}
                      </p>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 使用提示 */}
        {!query && !isLoading && (
          <Card className="mt-6 bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                搜索提示
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• 使用自然语言提问，例如："什么是机器学习？"</li>
                <li>• 输入关键词进行语义搜索，例如："数据结构"</li>
                <li>• 选择特定知识库以缩小搜索范围</li>
                <li>• 使用"三层检索"模式获得更精确的结果</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState title="加载中..." className="h-screen" />}>
      <SearchPageContent />
    </Suspense>
  )
}
