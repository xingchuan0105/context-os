'use client'

import { Citation, CitationSource } from './Citation'
import { useMemo, useState } from 'react'

export interface MessageCitation {
  index: number
  content: string
  source: CitationSource
  score?: number
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: MessageCitation[]
}

/**
 * 消息解析器 - 解析文本中的引用标记
 * 支持格式：
 * - {{citation:1}} - 引用索引 1
 * - [citation:1] - 引用索引 1
 * - [[1]] - 引用索引 1
 * - ①②③ - Unicode 上标数字
 */
export function parseMessageWithCitations(
  content: string,
  citations?: MessageCitation[]
): { segments: Array<{ type: 'text' | 'citation'; content?: string; citation?: MessageCitation }> } {
  const result: Array<{ type: 'text' | 'citation'; content?: string; citation?: MessageCitation }> = []

  const citationMap = new Map<number, MessageCitation>()
  for (const citation of citations || []) {
    citationMap.set(citation.index, citation)
  }

  const buildMissingCitation = (index: number): MessageCitation => ({
    index,
    content: `Citation data not found for [${index}].`,
    source: {
      docId: '',
      docName: 'Unknown source',
    },
  })

  // 正则匹配 [[N]] 或 [[N, M, ...]] 格式
  // 匹配 [[1]], [[2]], [[1]][[2]], [[3, 11]] 等格式
  const citationRegex = /\[\[(\d+(?:\s*,\s*\d+)*)\]\]/g
  let lastIndex = 0
  let match

  while ((match = citationRegex.exec(content)) !== null) {
    // 添加引用前的文本
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      })
    }

    // match[1] 可能是 "3" 或 "3, 11" 格式
    const indices = match[1].split(',').map(s => Number.parseInt(s.trim(), 10))

    for (const index of indices) {
      if (Number.isFinite(index)) {
        const citation = citationMap.get(index) || buildMissingCitation(index)
        result.push({ type: 'citation', citation })
      }
    }

    lastIndex = match.index + match[0].length
  }

  // 添加剩余文本
  if (lastIndex < content.length) {
    result.push({
      type: 'text',
      content: content.slice(lastIndex),
    })
  }

  return { segments: result.length > 0 ? result : [{ type: 'text', content }] }
}

/**
 * 简单的引用注入器
 * 自动检测内容中的句子末尾，添加引用标记
 */
export function injectCitations(
  content: string,
  citations: MessageCitation[]
): string {
  let result = content
  const sentences = content.split(/([。！？.!?])/)

  // 为每句话末尾添加引用
  let citationIndex = 0
  for (let i = 0; i < sentences.length && citationIndex < citations.length; i++) {
    const sentence = sentences[i]
    if (sentence.trim() && /[。！？.!?]/.test(sentences[i + 1] || '')) {
      const citation = citations[citationIndex]
      result = result.replace(sentence + sentences[i + 1], `${sentence}${sentences[i + 1]}{{citation:${citation.index}}}`)
      citationIndex++
    }
  }

  return result
}

/**
 * 消息渲染组件
 */
export function MessageRenderer({ message }: { message: Message }) {
  // 安全检查：确保 message 和 content 存在
  if (!message || typeof message !== 'object') {
    console.error('[MessageRenderer] Invalid message:', message)
    return <div className="text-red-500 text-sm">消息格式错误</div>
  }

  const { segments } = useMemo(
    () => {
      try {
        // 确保 content 是字符串
        const content = typeof message.content === 'string' ? message.content : String(message.content || '')

        // 调试日志
        console.log('[MessageRenderer] Parsing message:', {
          contentPreview: content.slice(0, 100) + '...',
          citationsCount: message.citations?.length || 0,
          hasCitationMarks: content.includes('[['),
        })

        const result = parseMessageWithCitations(content, message.citations)

        console.log('[MessageRenderer] Parse result:', {
          segmentsCount: result.segments.length,
          citationSegments: result.segments.filter(s => s.type === 'citation').length,
          textSegments: result.segments.filter(s => s.type === 'text').length,
        })

        return result
      } catch (error) {
        console.error('[MessageRenderer] Parse error:', error)
        return { segments: [{ type: 'text' as const, content: String(message.content || '') }] }
      }
    },
    [message.content, message.citations]
  )

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {segments.map((segment, i) => {
        try {
          if (segment.type === 'citation' && segment.citation) {
            console.log('[MessageRenderer] Rendering citation:', segment.citation.index)
            return <Citation key={`cit-${i}`} {...segment.citation} />
          }
          return (
            <span key={`txt-${i}`} dangerouslySetInnerHTML={{ __html: segment.content || '' }} />
          )
        } catch (error) {
          console.error('[MessageRenderer] Render segment error:', error, segment)
          return <span key={`txt-${i}`}>{segment.content || ''}</span>
        }
      })}
    </div>
  )
}

/**
 * 消息气泡组件
 */
export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const [showSources, setShowSources] = useState(false)
  const hasSources = (message.citations?.length || 0) > 0

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
            ? 'bg-muted text-muted-foreground'
            : 'bg-muted'
        }`}
      >
        {isSystem ? (
          <p className="text-sm italic">{message.content}</p>
        ) : (
          <MessageRenderer message={message} />
        )}
        {hasSources && !isSystem && (
          <div className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
            <button
              type="button"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => setShowSources((prev) => !prev)}
              aria-expanded={showSources}
            >
              引用 ({message.citations?.length || 0})
            </button>
            {showSources && (
              <div className="mt-2 space-y-2">
                {message.citations?.map((citation) => (
                  <div
                    key={`src-${citation.index}`}
                    className="rounded-md border border-border/60 bg-background/50 p-2 text-[11px] leading-relaxed"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        [{citation.index}] {citation.source.docName}
                      </span>
                      {typeof citation.score === 'number' && (
                        <span>{Math.round(citation.score * 100)}%</span>
                      )}
                    </div>
                    <div className="mt-1 line-clamp-3">
                      {citation.content}
                    </div>
                    {typeof citation.source.chunkIndex === 'number' && (
                      <div className="mt-1 opacity-70">
                        片段 #{citation.source.chunkIndex + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
