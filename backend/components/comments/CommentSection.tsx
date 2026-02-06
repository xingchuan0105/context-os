'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  MessageSquare,
  Send,
  Trash2,
  User,
  Loader2,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Comment {
  id: string
  content: string
  author: {
    id: string
    username: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

interface User {
  id: string
  username: string
  email: string
  avatar?: string
}

interface CommentSectionProps {
  documentId: string
  kbId: string
}

export function CommentSection({ documentId, kbId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // 获取���前用户
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setCurrentUser(data.user)
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      }
    }
    fetchUser()
  }, [])

  // 获取评论列表
  useEffect(() => {
    const fetchComments = async () => {
      setIsLoading(true)
      try {
        // TODO: 实现获取评论的 API
        const res = await fetch(`/api/documents/${documentId}/comments`)
        if (res.ok) {
          const data = await res.json()
          setComments(data.comments || [])
        }
      } catch (error) {
        console.error('Failed to fetch comments:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchComments()
  }, [documentId])

  // 提交评论
  const submitComment = async () => {
    if (!newComment.trim()) {
      toast.error('请输入评论内容')
      return
    }

    setIsSubmitting(true)
    try {
      // TODO: 实现提交评论的 API
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      })

      if (!res.ok) {
        throw new Error('发表评论失败')
      }

      const data = await res.json()
      setComments([data.comment, ...comments])
      setNewComment('')
      toast.success('评论已发表')
    } catch (error) {
      console.error('Failed to submit comment:', error)
      toast.error('发表评论失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 删除评论
  const deleteComment = async (commentId: string) => {
    if (!confirm('确定要删除这条评论吗？')) return

    try {
      // TODO: 实现删除评论的 API
      await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      setComments(comments.filter(c => c.id !== commentId))
      toast.success('评论已删除')
    } catch (error) {
      toast.error('删除失败')
    }
  }

  // 获取用户名首字母
  const getUserInitials = (username: string, email: string) => {
    return username ? username[0].toUpperCase() : email[0].toUpperCase()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* 标题 */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              评论 ({comments.length})
            </h3>
          </div>

          {/* 发表评论 */}
          <div className="space-y-3">
            <Textarea
              placeholder="写下你的评论..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              disabled={!currentUser}
            />
            {!currentUser ? (
              <p className="text-sm text-muted-foreground">
                请登录后发表评论
              </p>
            ) : (
              <div className="flex justify-end">
                <Button
                  onClick={submitComment}
                  disabled={isSubmitting || !newComment.trim()}
                  size="sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      发表中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      发表评论
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* 评论列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>还没有评论，快来发表第一条吧！</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="shrink-0">
                      <AvatarFallback>
                        {getUserInitials(comment.author.username, comment.author.email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {comment.author.username || '匿名用户'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </Badge>
                        </div>

                        {currentUser && currentUser.id === comment.author.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteComment(comment.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
