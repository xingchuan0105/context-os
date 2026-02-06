'use client'

import { FileText } from 'lucide-react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'

export interface CitationSource {
  docId: string
  docName: string
  chunkIndex?: number
  score?: number
}

export interface CitationProps {
  index: number
  content: string
  source: CitationSource
  score?: number
}

/**
 * Citation 引用组件
 * 显示为右上标数字，悬停显示详情卡片
 */
export function Citation({ index, content, source, score }: CitationProps) {
  // 将索引转换为上标数字字符 ①②③...
  const getSuperscriptNumber = (num: number): string => {
    const superscripts = ['\u2460', '\u2461', '\u2462', '\u2463', '\u2464',
                          '\u2465', '\u2466', '\u2467', '\u2468', '\u2469',
                          '\u246A', '\u246B', '\u246C', '\u246D', '\u246E',
                          '\u246F', '\u2470', '\u2471', '\u2472', '\u2473']
    if (num >= 1 && num <= 20) return superscripts[num - 1]
    return `[${num}]`
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex items-center justify-center ml-0.5 h-5 min-w-[20px] rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer text-xs px-1.5 transition-colors border border-blue-200"
          role="button"
          tabIndex={0}
        >
          {getSuperscriptNumber(index)}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="top" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">引用 [{index}]</span>
            {score !== undefined && score >= 0 && (
              <span className="text-xs text-muted-foreground">
                相关度: {Math.round(score * 100)}%
              </span>
            )}
          </div>
          <Separator />
          <p className="text-sm max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
            {content}
          </p>
          <Separator />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{source.docName}</span>
          </div>
          {source.chunkIndex !== undefined && (
            <div className="text-xs text-muted-foreground">
              片段索引: #{source.chunkIndex + 1}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * 内联引用标记组件（用于渲染在文本中的引用）
 */
export function CitationMarker({ index }: { index: number }) {
  const getSuperscriptNumber = (num: number): string => {
    const superscripts = ['\u2460', '\u2461', '\u2462', '\u2463', '\u2464',
                          '\u2465', '\u2466', '\u2467', '\u2468', '\u2469',
                          '\u246A', '\u246B', '\u246C', '\u246D', '\u246E',
                          '\u246F', '\u2470', '\u2471', '\u2472', '\u2473']
    if (num <= 20) return superscripts[num - 1]
    return num.toString()
  }

  return (
    <sup className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
      {getSuperscriptNumber(index)}
    </sup>
  )
}
