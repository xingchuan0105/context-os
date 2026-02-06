'use client'

/**
 * Sprint 0 测试页面
 * 测试 SSE 流式响应和 Citation 组件
 */

import { useState } from 'react'
import { useSSEChat } from '@/hooks/use-sse-stream'
import { MessageBubble, Message, MessageCitation } from '@/components/chat/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Citation, CitationSource } from '@/components/chat/Citation'
import { Send, Loader2 } from 'lucide-react'

// 模拟引用数据
const mockCitations: MessageCitation[] = [
  {
    index: 1,
    content: 'Context OS 是一个基于 RAG 的知识管理工具，帮助用户组织、检索和思考知识。它采用混合架构，结合了向量数据库和大语言模型的能力。',
    source: {
      docId: 'doc-1',
      docName: 'Context OS PRD.md',
      chunkIndex: 0,
      score: 0.92,
    },
  },
  {
    index: 2,
    content: 'Sprint 0 的目标是建立流式对话、LLM 集成、引用系统的技术基础。这包括 SSE (Server-Sent Events)、SiliconFlow LLM 集成和 Citation 组件。',
    source: {
      docId: 'doc-2',
      docName: 'Sprint 0 基础设施.md',
      chunkIndex: 1,
      score: 0.88,
    },
  },
  {
    index: 3,
    content: '引用系统支持上标数字标记，鼠标悬停显示内容卡片，包含文档来源、相关度等信息。',
    source: {
      docId: 'doc-3',
      docName: 'Citation 组件设计.md',
      chunkIndex: 2,
      score: 0.85,
    },
  },
]

export default function Sprint0TestPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'Sprint 0 测试环境 - SSE 流式响应 + Citation 组件',
    },
  ])

  const { content, citations, isLoading, error, sendMessage, abort } =
    useSSEChat('/api/chat/stream')

  const handleSend = () => {
    if (!input.trim()) return

    // 添加用户消息
    setMessages((prev) => [...prev, { role: 'user', content: input }])

    // 发送消息（启用模拟引用）
    sendMessage(input, { mockCitations: true })

    setInput('')
  }

  // 当收到完整响应后，添加到消息列表
  useState(() => {
    if (!isLoading && content && citations.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content,
          citations,
        },
      ])
    }
  })

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Sprint 0 测试页面</h1>
          <p className="text-muted-foreground">
            测试 SSE 流式响应、LLM 集成和 Citation 组件
          </p>
        </div>

        {/* Citation 组件展示 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Citation 组件展示</h2>
          <p className="text-sm text-muted-foreground mb-4">
            悬停在下标数字上查看引用详情：
          </p>
          <div className="space-y-4">
            <p>
              Context OS 是一个基于 RAG 的知识管理工具
              <Citation {...mockCitations[0]} />
            </p>
            <p>
              Sprint 0 的目标是建立技术基础
              <Citation {...mockCitations[1]} />
            </p>
            <p>
              引用系统支持上标数字标记
              <Citation {...mockCitations[2]} />
            </p>
          </div>
        </Card>

        {/* 聊天测试 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">流式聊天测试</h2>

          {/* 消息列表 */}
          <div className="min-h-[300px] max-h-[400px] overflow-y-auto mb-4 space-y-4 p-4 bg-muted/30 rounded-lg">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {/* 实时流式响应 */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                  <p className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {content || '思考中...'}
                  </p>
                  {citations.map((cit) => (
                    <Citation key={cit.index} {...cit} />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="text-destructive text-sm p-2 bg-destructive/10 rounded">
                错误: {error}
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入消息测试流式响应..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={isLoading ? abort : handleSend}
              disabled={isLoading ? false : !input.trim()}
              variant={isLoading ? 'destructive' : 'default'}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  取消
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  发送
                </>
              )}
            </Button>
          </div>

          {/* 状态信息 */}
          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <div>状态: {isLoading ? '连接中...' : '空闲'}</div>
            <div>字符数: {content.length}</div>
            <div>引用数: {citations.length}</div>
          </div>
        </Card>

        {/* 组件清单 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">已创建的文件</h2>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>✅ lib/sse/stream-builder.ts - SSE 流构建工具</li>
            <li>✅ hooks/use-sse-stream.ts - SSE 客户端 Hook</li>
            <li>✅ components/ui/badge.tsx - Badge 组件</li>
            <li>✅ components/ui/hover-card.tsx - HoverCard 组件</li>
            <li>✅ components/chat/Citation.tsx - Citation 组件</li>
            <li>✅ components/chat/Message.tsx - Message 渲染组件</li>
            <li>✅ app/api/chat/stream/route.ts - 流式 Chat API</li>
            <li>✅ app/test/sprint-0/page.tsx - 测试页面</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
