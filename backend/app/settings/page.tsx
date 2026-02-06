'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  User,
  Settings,
  Database,
  Bell,
  Palette,
  Save,
  Loader2,
  Trash2,
  Download,
  Upload,
} from 'lucide-react'

export default function SettingsPage() {
  // 用户信息
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // 个人资料
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')

  // 偏好设置
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [language, setLanguage] = useState<'zh' | 'en'>('zh')
  const [defaultModel, setDefaultModel] = useState('qwen3-plus')
  const [temperature, setTemperature] = useState('0.7')
  const [maxTokens, setMaxTokens] = useState('4000')

  // 通知设置
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [documentNotifications, setDocumentNotifications] = useState(true)
  const [shareNotifications, setShareNotifications] = useState(false)

  // 存储统计
  const [storageUsed, setStorageUsed] = useState('0 MB')
  const [documentCount, setDocumentCount] = useState(0)
  const [kbCount, setKbCount] = useState(0)

  // 获取用户信息
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUsername(data.user.username || '')
          setEmail(data.user.email || '')
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [])

  // 获取存储统计
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // TODO: 调用实际的统计 API
        setDocumentCount(12)
        setKbCount(3)
        setStorageUsed('156 MB')
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    fetchStats()
  }, [])

  // 保存个人资料
  const saveProfile = async () => {
    setIsSaving(true)
    try {
      // TODO: 实现保存 API
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('个人资料已保存')
    } catch (error) {
      toast.error('保存失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  // 保存偏好设置
  const savePreferences = async () => {
    setIsSaving(true)
    try {
      // TODO: 实现保存 API
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('偏好设置已保存')
    } catch (error) {
      toast.error('保存失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  // 清理缓存
  const clearCache = async () => {
    if (!confirm('确定要清理缓存吗？')) return

    try {
      // TODO: 实现清理 API
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('缓存已清理')
      setStorageUsed('0 MB')
    } catch (error) {
      toast.error('清理失败，请重试')
    }
  }

  // 导出数据
  const exportData = async () => {
    try {
      const data = {
        profile: { username, email, bio },
        preferences: { theme, language, defaultModel },
        exportDate: new Date().toISOString(),
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `context-os-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('数据已导出')
    } catch (error) {
      toast.error('导出失败')
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* 标题 */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Settings className="h-7 w-7 text-primary" />
            设置
          </h1>
          <p className="text-muted-foreground mt-1">
            管理您的账户信息和偏好设置
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="profile">个人资料</TabsTrigger>
            <TabsTrigger value="preferences">偏好设置</TabsTrigger>
            <TabsTrigger value="notifications">通知</TabsTrigger>
            <TabsTrigger value="storage">存储管理</TabsTrigger>
          </TabsList>

          {/* 个人资料 */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  个人资料
                </CardTitle>
                <CardDescription>
                  更新您的个人信息和公开资料
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="输入用户名"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">个人简介</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="介绍一下自己..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    {bio.length}/200 字符
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        保存更改
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>账户安全</CardTitle>
                <CardDescription>
                  管理您的密码和安全设置
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline">修改密码</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 偏好设置 */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  外观设置
                </CardTitle>
                <CardDescription>
                  自定义应用的外观和语言
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>主题</Label>
                  <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">浅色</SelectItem>
                      <SelectItem value="dark">深色</SelectItem>
                      <SelectItem value="system">跟随系统</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>语言</Label>
                  <Select value={language} onValueChange={(v) => setLanguage(v as 'zh' | 'en')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI 模型设置</CardTitle>
                <CardDescription>
                  配置默认的 AI 模型参数
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="model">默认模型</Label>
                  <Select value={defaultModel} onValueChange={setDefaultModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qwen3-plus">Qwen3 Plus</SelectItem>
                      <SelectItem value="qwen3-turbo">Qwen3 Turbo</SelectItem>
                      <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature (0-1)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    较低的值会使输出更确定，较高的值会使输出更随机
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTokens">最大 Token 数</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min="100"
                    max="32000"
                    step="100"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={savePreferences} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        保存更改
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 通知设置 */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  通知设置
                </CardTitle>
                <CardDescription>
                  管理您想接收的通知类型
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notif">邮件通知</Label>
                    <p className="text-sm text-muted-foreground">
                      接收重要的系统更新和通知
                    </p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="doc-notif">文档处理完成</Label>
                    <p className="text-sm text-muted-foreground">
                      当文档处理完成时通知我
                    </p>
                  </div>
                  <Switch
                    id="doc-notif"
                    checked={documentNotifications}
                    onCheckedChange={setDocumentNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="share-notif">分享通知</Label>
                    <p className="text-sm text-muted-foreground">
                      当有人分享文档给我时通知我
                    </p>
                  </div>
                  <Switch
                    id="share-notif"
                    checked={shareNotifications}
                    onCheckedChange={setShareNotifications}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 存储管理 */}
          <TabsContent value="storage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  存储统计
                </CardTitle>
                <CardDescription>
                  查看您的存储使用情况
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">已使用空间</p>
                    <p className="text-2xl font-bold">{storageUsed}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">文档数量</p>
                    <p className="text-2xl font-bold">{documentCount}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">知识库数量</p>
                    <p className="text-2xl font-bold">{kbCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>存储管理</CardTitle>
                <CardDescription>
                  管理您的数据和缓存
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">清理缓存</p>
                    <p className="text-sm text-muted-foreground">
                      清除临时文件和缓存数据
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearCache}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    清理
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">导出数据</p>
                    <p className="text-sm text-muted-foreground">
                      下载您的所有数据
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportData}>
                    <Download className="h-4 w-4 mr-2" />
                    导出
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">导入数据</p>
                    <p className="text-sm text-muted-foreground">
                      从备份文件恢复数据
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <label htmlFor="import-file" className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      导入
                      <input
                        id="import-file"
                        type="file"
                        className="hidden"
                        accept=".json"
                      />
                    </label>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive">危险区域</CardTitle>
                <CardDescription>
                  这些操作不可逆，请谨慎操作
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" size="sm">
                  删除所有数据
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
