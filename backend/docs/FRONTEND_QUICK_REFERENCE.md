# 前端技术栈快速参考 🚀

> 完整规范请查看: [FRONTEND_TECH_STACK.md](./FRONTEND_TECH_STACK.md)

---

## ✅ 必须使用的技术

```
Next.js 16.1.1 (App Router)
React 19.2.3
TypeScript 5.x (strict mode)
Tailwind CSS 4.x
Zustand 5.0.10
Radix UI (无样式组件)
Lucide React (图标)
```

---

## ❌ 严格禁止

```
❌ Redux / MobX → 用 Zustand
❌ React Query → 用 Zustand + fetch
❌ Material-UI / Ant Design → 用 Radix UI + Tailwind
❌ styled-components / CSS Modules → 用 Tailwind CSS
❌ JavaScript → 必须用 TypeScript
❌ Pages Router → 必须用 App Router
```

---

## 📁 关键目录

```
app/                    # Next.js 页面和 API
├── page.tsx            # 主页
├── login/              # 登录
├── kb/[id]/            # 知识库详情
└── api/                # API 路由

components/
├── ui/                 # UI 组件 (shadcn/ui)
├── layout/             # 布局组件
└── chat/               # 聊天组件

lib/
├── stores/             # Zustand 状态管理
├── api/                # API 客户端
├── types/              # TypeScript 类型
└── utils.ts            # 工具函数 (cn)
```

---

## 🎯 组件模板

```typescript
'use client' // 仅在需要交互时添加

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MyComponentProps {
  title: string
  className?: string
}

export function MyComponent({ title, className }: MyComponentProps) {
  return (
    <div className={cn('p-4', className)}>
      <Button>{title}</Button>
    </div>
  )
}
```

---

## 🔄 Zustand Store 模板

```typescript
// lib/stores/example-store.ts
import { create } from 'zustand'

interface ExampleState {
  data: any[]
  isLoading: boolean
  setData: (data: any[]) => void
}

export const useExampleStore = create<ExampleState>((set) => ({
  data: [],
  isLoading: false,
  setData: (data) => set({ data }),
}))
```

---

## 🎨 常用 Tailwind Classes

```typescript
// 布局
flex, grid, gap-4, p-4, m-4, rounded-lg

// 颜色 (使用语义化变量)
bg-background, text-foreground, bg-primary, text-destructive

// 状态
hover:bg-muted/50, disabled:opacity-50, focus:ring-2

// 响应式
md:flex-row, lg:grid-cols-3
```

---

## 📋 提交前检查

```bash
# 1. 类型检查
npx tsc --noEmit

# 2. 代码检查
npm run lint

# 3. 构建测试
npm run build
```

**检查清单**:
- [ ] 使用 TypeScript
- [ ] 定义 Props 接口
- [ ] 使用 `@/` 路径别名
- [ ] 使用 Tailwind classes
- [ ] 从 `components/ui/` 导入 UI 组件
- [ ] 从 `lib/stores/` 导入状态
- [ ] Server Component 除非需要交互才加 `'use client'`

---

**快速参考版本 1.0.0** | 生成于 2025-01-14
