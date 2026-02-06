'use client'

/**
 * 对话历史清单组件
 */

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MessageSquare, Plus, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/lib/stores/chat-store'
import { ChatSession } from '@/lib/types/chat'
import { cn } from '@/lib/utils'

interface ChatHistoryListProps {
  kbId: string
  className?: string
}

export function ChatHistoryList({ kbId, className }: ChatHistoryListProps) {
  const router = useRouter()
  const params = useParams()
  const currentChatId = params?.chatId as string | undefined

  const { sessions, setSessions, setCurrentSession } = useChatStore()

  // 加载会话列表
  useEffect(() => {
    fetchSessions()
  }, [kbId])

  const fetchSessions = async () => {
    try {
      const res = await fetch(`/api/chat/sessions?kb_id=${kbId}`)
      const data = await res.json()
      if (data.sessions) {
        setSessions(data.sessions)
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kbId }),
      })
      const data = await res.json()
      if (data.session) {
        router.push(`/kb/${kbId}/chat/${data.session.id}`)
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const selectSession = (session: ChatSession) => {
    setCurrentSession(session)
    router.push(`/kb/${kbId}/chat/${session.id}`)
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
      fetchSessions()
      if (currentChatId === sessionId) {
        setCurrentSession(null)
        router.push(`/kb/${kbId}/chat`)
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">对话历史</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={createNewSession}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1 h-[200px]">
        <div className="space-y-1 px-1">
          {sessions.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              暂无对话
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors',
                  currentChatId === session.id
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50'
                )}
                onClick={() => selectSession(session)}
              >
                <MessageSquare className="h-3 w-3 shrink-0" />
                <span className="flex-1 truncate">{session.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => deleteSession(session.id, e)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
