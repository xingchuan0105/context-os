'use client'

/**
 * Chat 主页面
 * 三栏布局：历史会话 + 文件源 | 对话区 | 笔记预览
 */

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useChatStore } from '@/lib/stores/chat-store'
import { AppShell } from '@/components/layout/AppShell'
import { LeftSidebar } from '@/components/chat/LeftSidebar'
import { CollapsibleSection } from '@/components/chat/CollapsibleSection'
import { ChatHistoryList } from '@/components/chat/ChatHistoryList'
import { DocumentSourceList } from '@/components/chat/DocumentSourceList'
import { ChatArea } from '@/components/chat/ChatArea'
import { NotesPreviewSidebar } from '@/components/chat/NotesPreviewSidebar'
import { Citation } from '@/components/chat/Citation'

// 测试组件 - 验证 Citation 和 HoverCard 是否工作
function TestCitationComponent() {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg p-4 shadow-xl">
      <div className="text-sm font-bold mb-2 text-blue-600">🧪 测试组件（悬停查看）</div>
      <div className="flex items-center gap-2">
        <span className="text-xs">引用小标：</span>
        <Citation
          index={1}
          content="这是一个测试引用内容。如果你能看到这个悬浮卡片，说明 Citation 组件和 HoverCard 组件都正常工作。"
          source={{
            docId: 'test-doc-id',
            docName: '测试文档.pdf',
            chunkIndex: 0,
          }}
          score={0.95}
        />
        <Citation
          index={2}
          content="这是第二个测试引用。"
          source={{
            docId: 'test-doc-id-2',
            docName: '测试文档2.pdf',
            chunkIndex: 1,
          }}
          score={0.88}
        />
      </div>
    </div>
  )
}

export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const kbId = params?.id as string
  const chatId = params?.chatId as string | undefined

  const { setCurrentSession, clear } = useChatStore()

  const [sessionId, setSessionId] = useState<string>(chatId || '')

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kbId }),
      })
      const data = await res.json()
      if (data.session) {
        setSessionId(data.session.id)
        setCurrentSession(data.session)
        router.push(`/kb/${kbId}/chat/${data.session.id}`)
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  useEffect(() => {
    if (!kbId) {
      router.push('/')
      return
    }

    // 清理之前的状态
    clear()

    // 如果没有 chatId，创建新会话
    if (!chatId) {
      createNewSession()
    } else {
      setSessionId(chatId)
    }

    return () => {
      clear()
    }
  }, [kbId, chatId])

  if (!kbId) return null

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* 左侧：历史会话 + 文件源 */}
        <LeftSidebar className="w-64 border-r">
          <CollapsibleSection defaultExpanded={true}>
            <ChatHistoryList kbId={kbId} />
          </CollapsibleSection>

          <CollapsibleSection defaultExpanded={true}>
            <DocumentSourceList kbId={kbId} />
          </CollapsibleSection>
        </LeftSidebar>

        {/* 中间：对话区 */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {sessionId ? (
            <ChatArea sessionId={sessionId} kbId={kbId} className="flex-1" />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              创建会话中...
            </div>
          )}

          {/* 测试组件 - 验证 Citation 和 HoverCard 是否工作 */}
          <TestCitationComponent />
        </div>

        {/* 右侧：笔记预览 */}
        <NotesPreviewSidebar kbId={kbId} className="w-72 border-l" />
      </div>
    </AppShell>
  )
}
