'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Link2,
  Copy,
  Check,
  Loader2,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  documentTitle: string
}

interface SharedLink {
  token: string
  url: string
  expiresAt: string | null
  accessCount: number
  permissions: 'view' | 'view-comment'
  createdAt: string
}

type SharePermission = 'view' | 'view-comment'

export function ShareDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
}: ShareDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [expiryDays, setExpiryDays] = useState<string>('7')
  const [permissions, setPermissions] = useState<'view' | 'view-comment'>('view')
  const [existingLinks, setExistingLinks] = useState<SharedLink[]>([])

  // 生成分享链接
  const generateShareLink = async () => {
    setIsGenerating(true)
    try {
      // TODO: 实现生成分享链接的 API
      const response = await fetch(`/api/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiryDays: parseInt(expiryDays),
          permissions,
        }),
      })

      if (!response.ok) {
        throw new Error('生成分享链接失败')
      }

      const data = await response.json()
      const newLink: SharedLink = {
        token: data.token,
        url: `${window.location.origin}/shared/${data.token}`,
        expiresAt: data.expiresAt,
        accessCount: 0,
        permissions,
        createdAt: new Date().toISOString(),
      }

      setShareLink(newLink.url)
      setExistingLinks([newLink, ...existingLinks])
      toast.success('分享链接已生成')
    } catch (error) {
      console.error('Failed to generate share link:', error)
      toast.error('生成分享链接失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 复制链接
  const copyToClipboard = async (url: string) => {
    setIsCopying(true)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制到剪贴板')
    } catch (error) {
      toast.error('复制失败，请手动复制')
    } finally {
      setTimeout(() => setIsCopying(false), 2000)
    }
  }

  // 删除分享链接
  const deleteShareLink = async (token: string) => {
    try {
      // TODO: 实现删除分享链接的 API
      await fetch(`/api/shared/${token}`, { method: 'DELETE' })
      setExistingLinks(existingLinks.filter(link => link.token !== token))
      if (shareLink?.includes(token)) {
        setShareLink(null)
      }
      toast.success('分享链接已删除')
    } catch (error) {
      toast.error('删除失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            分享文档
          </DialogTitle>
          <DialogDescription>
            为 "<span className="font-medium">{documentTitle}</span>" 生成分享链接
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 生成新链接 */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-medium">创建新链接</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>有效期</Label>
                <Select value={expiryDays} onValueChange={setExpiryDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 天</SelectItem>
                    <SelectItem value="7">7 天</SelectItem>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="0">永久</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>访问权限</Label>
                <Select value={permissions} onValueChange={(v) => setPermissions(v as SharePermission)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">仅查看</SelectItem>
                    <SelectItem value="view-comment">查看和评论</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={generateShareLink}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  生成分享链接
                </>
              )}
            </Button>
          </div>

          {/* 当前链接 */}
          {shareLink && (
            <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center justify-between">
                <Label className="text-base">分享链接</Label>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  新创建
                </Badge>
              </div>
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="flex-1" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(shareLink)}
                >
                  {isCopying ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 已有链接列表 */}
          {existingLinks.length > 1 && (
            <div className="space-y-3">
              <h3 className="font-medium">已有链接</h3>
              <div className="space-y-2">
                {existingLinks.slice(1).map((link) => (
                  <div
                    key={link.token}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link2 className="h-3 w-3 text-muted-foreground" />
                        <code className="text-sm truncate">{link.url}</code>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {link.expiresAt
                            ? formatDistanceToNow(new Date(link.expiresAt), {
                                addSuffix: true,
                                locale: zhCN,
                              })
                            : '永久有效'}
                        </span>
                        <span className="flex items-center gap-1">
                          {link.permissions === 'view' ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                          {link.permissions === 'view' ? '仅查看' : '可评论'}
                        </span>
                        <span>访问 {link.accessCount} 次</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(link.url)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        复制
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteShareLink(link.token)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 提示信息 */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• 任何人拥有链接都可以访问该文档</p>
            <p>• 您可以随时删除分享链接</p>
            <p>• 到期后链接将自动失效</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
