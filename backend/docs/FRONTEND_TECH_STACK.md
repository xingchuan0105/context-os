# Context-OS 前端技术栈规范

> **本文档是前端开发的强约束规范** ⚠️
> 所有前端开发工作必须严格遵守本文档规定的技术栈和最佳实践。

---

## 📋 目录

- [核心技术栈](#核心技术栈)
- [框架与库](#框架与库)
- [状态管理](#状态管理)
- [UI 组件库](#ui-组件库)
- [样式系统](#样式系统)
- [类型系统](#类型系统)
- [代码规范](#代码规范)
- [项目结构](#项目结构)
- [开发工作流](#开发工作流)
- [禁止事项](#禁止事项)

---

## 🎯 核心技术栈

### 必须使用的技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 16.1.1 | React 框架 (App Router) |
| **React** | 19.2.3 | UI 库 |
| **TypeScript** | 5.x | 类型系统 |
| **Tailwind CSS** | 4.x | 样式系统 |
| **Zustand** | 5.0.10 | 状态管理 |

### 禁止使用的技术

❌ **严禁使用**:
- ~~Redux~~ (使用 Zustand 替代)
- ~~MobX~~ (使用 Zustand 替代)
- ~~React Query~~ (当前项目未采用)
- ~~Material-UI~~ (使用 Radix UI 替代)
- ~~Ant Design~~ (使用 Radix UI 替代)
- ~~styled-components~~ (使用 Tailwind CSS 替代)
- ~~CSS Modules~~ (使用 Tailwind CSS 替代)

---

## 📦 框架与库

### Next.js 配置

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone', // Docker/standalone 输出
  serverExternalPackages: ['better-sqlite3'], // 外部化原生模块
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('better-sqlite3')
    }
    return config
  },
}

export default nextConfig
```

### 关键约束

✅ **必须使用**:
- Next.js **App Router** (不是 Pages Router)
- TypeScript **strict mode**
- Server Components 和 Client Components 分离

❌ **禁止使用**:
- ~~Pages Router~~ (`pages/` 目录)
- JavaScript 文件 (必须使用 `.ts` 或 `.tsx`)

---

## 🔄 状态管理

### Zustand (全局状态)

**唯一允许的状态管理方案**:

```typescript
// lib/stores/example-store.ts
import { create } from 'zustand'

interface ExampleState {
  data: any[]
  isLoading: boolean
  error: string | null
  setData: (data: any[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useExampleStore = create<ExampleState>((set) => ({
  data: [],
  isLoading: false,
  error: null,
  setData: (data) => set({ data }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))
```

### 现有 Store

| Store | 路径 | 用途 |
|-------|------|------|
| `useKBStore` | `lib/stores/kb-store.ts` | 知识库状态 |
| `useChatStore` | `lib/stores/chat-store.ts` | 聊天状态 |
| `useDocumentStore` | `lib/stores/document-store.ts` | 文档状态 |
| `useDocumentSourceStore` | `lib/stores/document-source-store.ts` | 文档源选择 |
| `useSidebarStore` | `lib/stores/sidebar-store.ts` | 侧边栏折叠 |

### 状态管理最佳实践

✅ **必须遵守**:
1. **类型定义**: Store 的 state 必须定义 TypeScript 接口
2. **单一职责**: 每个 Store 只管理一个领域的状态
3. **不可变更新**: 使用函数式更新确保不可变性
4. **最小化 State**: 只存储必要的状态，派生数据用 getters

❌ **禁止**:
- 在组件中直接修改 store 状态 (必须使用提供的 actions)
- 在多个 store 中重复存储相同数据
- 在 store 中存储可序列化的数据 (如 DOM 元素)

---

## 🎨 UI 组件库

### Radix UI (无样式组件)

**唯一允许的组件基础库**:

```bash
# 已安装的 Radix UI 组件
@radix-ui/react-avatar
@radix-ui/react-checkbox
@radix-ui/react-dialog
@radix-ui/react-dropdown-menu
@radix-ui/react-hover-card
@radix-ui/react-label
@radix-ui/react-scroll-area
@radix-ui/react-select
@radix-ui/react-separator
@radix-ui/react-slot
@radix-ui/react-tabs
@radix-ui/react-toast
@radix-ui/react-tooltip
```

### 使用约定

✅ **必须**:
- 使用 `components/ui/` 下的封装组件
- 基于 Radix UI 添加 Tailwind 样式
- 遵循 shadcn/ui 组件结构

❌ **禁止**:
- 直接使用 Radix UI 原始组件 (必须封装到 `components/ui/`)
- 引入其他 UI 库 (Material-UI, Ant Design, etc.)
- 自己实现复杂组件 (如 Dialog, Dropdown) 而不用 Radix UI

### Lucide React (图标)

**唯一允许的图标库**:

```typescript
import { Plus, Search, Trash2, Loader2 } from 'lucide-react'
```

---

## 🎨 样式系统

### Tailwind CSS 4.x

**唯一允许的样式方案**:

```css
/* app/globals.css */
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --primary: 221.2 83.2% 53.3%;
    /* ... 完整的设计 tokens */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    /* ... 暗色主题 */
  }
}
```

### 设计 Tokens

**必须使用的设计变量**:

```typescript
// 语义化颜色
bg-background        // 背景色
bg-card             // 卡片背景
text-foreground     // 前景色
text-muted-foreground  // 次要文字
bg-primary          // 主色
text-primary-foreground  // 主色文字
bg-muted            // 弱化背景
bg-destructive      // 危险色

// 布局
border-border       // 边框
rounded-lg          // 圆角
p-4, p-6, p-8       // 内边距标准
gap-4, gap-6        // 间距标准
```

### 样式约束

✅ **必须**:
- 使用 Tailwind utility classes
- 使用语义化设计 tokens
- 遵循设计系统的一致性

❌ **禁止**:
- ~~内联样式~~ (`style={{ color: 'red' }}`)
- ~~CSS Modules~~
- ~~styled-components~~
- ~~全局 CSS 类~~ (除了 Tailwind)
- ~~硬编码颜色值~~ (`text-red-500` 必须用 `text-destructive`)

### 工具函数

```typescript
// lib/utils.ts (已提供)
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 🔷 类型系统

### TypeScript 配置

```json
{
  "compilerOptions": {
    "strict": true,           // ✅ 必须开启
    "target": "ES2017",
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./*"]          // ✅ 必须使用路径别名
    }
  }
}
```

### 类型定义规范

✅ **必须**:
1. **所有文件必须使用 TypeScript**
2. **所有组件必须定义 Props 接口**
3. **禁止使用 `any` 类型** (特殊场景必须添加注释说明)
4. **类型定义集中管理** (`lib/types/`)

```typescript
// ✅ 正确
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  children: React.ReactNode
  onClick?: () => void
}

export function Button({ variant = 'default', size = 'default', children, onClick }: ButtonProps) {
  // ...
}

// ❌ 错误
export function Button(props: any) {
  // ...
}
```

### 类型导入规范

```typescript
// ✅ 正确 - 类型从 stores 导入
import { useKBStore, KnowledgeBase } from '@/lib/stores/kb-store'

// ❌ 错误 - 重复定义类型
interface KnowledgeBase {
  id: string
  title: string
  // ...
}
```

---

## 📐 代码规范

### 文件命名

| 类型 | 命名规范 | 示例 |
|------|---------|------|
| React 组件 | PascalCase | `Button.tsx`, `ChatArea.tsx` |
| 工具函数 | camelCase | `formatDate.ts`, `cn.ts` |
| 类型定义 | camelCase | `chat.ts`, `index.ts` |
| Hooks | camelCase + `use` 前缀 | `useAuth.ts`, `useKB.ts` |
| Stores | camelCase + `-store` 后缀 | `kb-store.ts`, `chat-store.ts` |

### 组件结构

```typescript
// ✅ 标准组件结构
'use client' // 如果需要

// 1. 导入
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useExampleStore } from '@/lib/stores/example-store'

// 2. 类型定义
interface MyComponentProps {
  title: string
  onSubmit: () => void
}

// 3. 子组件
function ChildComponent({ data }: { data: any[] }) {
  // ...
}

// 4. 主组件
export function MyComponent({ title, onSubmit }: MyComponentProps) {
  // 5. Hooks (useState, useEffect, store)
  const [state, setState] = useState('')
  const { data } = useExampleStore()

  // 6. 事件处理函数
  const handleClick = () => {
    // ...
  }

  // 7. 渲染
  return (
    <div>
      <Button onClick={handleClick}>{title}</Button>
    </div>
  )
}
```

### Client vs Server Components

```typescript
// ✅ Server Component (默认)
export default function Page() {
  // 可以使用 async/await
  const data = await fetch('/api/data')
  return <div>{data}</div>
}

// ✅ Client Component (需要交互)
'use client'
import { useState } from 'react'

export function InteractiveComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**规则**:
- **默认使用 Server Components** (性能更好)
- **需要交互时添加 `'use client'`** (onClick, useState, etc.)
- **保持 Server Components 尽可能多**

---

## 📁 项目结构

```
context-os/
├── app/                          # Next.js App Router (主要代码)
│   ├── page.tsx                 # 主页 (/)
│   ├── layout.tsx               # 根布局
│   ├── globals.css              # 全局样式
│   ├── login/
│   │   └── page.tsx             # 登录页
│   ├── kb/
│   │   └── [id]/
│   │       ├── page.tsx         # 知识库详情
│   │       └── chat/
│   │           └── page.tsx     # 聊天页
│   └── api/                     # API 路由
│       ├── auth/
│       ├── documents/
│       └── chat/
│
├── components/                   # React 组件
│   ├── ui/                      # UI 基础组件 (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── layout/                  # 布局组件
│   │   ├── AppShell.tsx
│   │   ├── AppSidebar.tsx
│   │   └── Header.tsx
│   └── chat/                    # 聊天相关组件
│       ├── ChatArea.tsx
│       ├── Message.tsx
│       └── ...
│
└── lib/                         # 核心库代码
    ├── stores/                  # Zustand 状态管理
    │   ├── kb-store.ts
    │   ├── chat-store.ts
    │   └── ...
    ├── api/                     # API 客户端
    │   ├── knowledge-base.ts
    │   ├── documents.ts
    │   └── ...
    ├── types/                   # TypeScript 类型
    │   ├── chat.ts
    │   └── ...
    ├── utils.ts                 # 工具函数
    └── auth/                    # 认证相关
        └── session.ts
```

### 路径别名

✅ **必须使用**:

```typescript
// ✅ 正确
import { Button } from '@/components/ui/button'
import { useKBStore } from '@/lib/stores/kb-store'

// ❌ 错误
import { Button } from '../../../components/ui/button'
```

---

## 🛠️ 开发工作流

### 必要的开发命令

```bash
# 开发
npm run dev

# 构建检查
npm run build

# 代码检查
npm run lint

# 类型检查
npx tsc --noEmit
```

### 开发流程

1. **创建新组件**:
   ```bash
   # 1. 创建组件文件
   touch components/my-components/MyComponent.tsx

   # 2. 定义 Props 接口
   # 3. 实现组件逻辑
   # 4. 添加样式 (Tailwind classes)
   # 5. 导出组件
   ```

2. **创建新页面**:
   ```bash
   # 1. 在 app/ 下创建目录
   mkdir app/new-page

   # 2. 创建 page.tsx
   # 3. 实现页面逻辑
   ```

3. **添加新状态管理**:
   ```bash
   # 1. 创建 store 文件
   touch lib/stores/new-store.ts

   # 2. 定义 state 接口
   # 3. 使用 zustand create store
   # 4. 导出 hook
   ```

---

## 🚫 禁止事项

### 严格禁止

❌ **禁止使用这些技术/库**:

| 禁止项 | 替代方案 | 原因 |
|--------|---------|------|
| Redux | Zustand | 过于复杂 |
| React Query | Zustand + fetch | 未采用 |
| Material-UI | Radix UI + Tailwind | 不符合设计系统 |
| Ant Design | Radix UI + Tailwind | 不符合设计系统 |
| styled-components | Tailwind CSS | 性能和维护性 |
| CSS Modules | Tailwind CSS | 统一样式系统 |
| Sass/Less | Tailwind CSS | 不需要 CSS 预处理器 |
| classnames | clsx + tailwind-merge | 已有更好的替代 |
| Axios (前端) | fetch | 原生 API 足够 |
| JavaScript | TypeScript | 必须使用类型 |

### 代码模式禁止

❌ **禁止这些代码模式**:

```typescript
// ❌ 禁止 - 使用 any
const data: any = await fetch('/api/data')

// ✅ 正确 - 定义类型
interface DataResponse {
  id: string
  name: string
}
const data: DataResponse = await fetch('/api/data')

// ❌ 禁止 - 内联样式
<div style={{ color: 'red', padding: '10px' }} />

// ✅ 正确 - Tailwind classes
<div className="text-destructive p-4" />

// ❌ 禁止 - 重复类型定义
interface User {
  id: string
  name: string
}

// ✅ 正确 - 从统一位置导入
import { User } from '@/lib/types/user'

// ❌ 禁止 - 直接使用 Radix UI
import { Dialog } from '@radix-ui/react-dialog'

// ✅ 正确 - 使用封装的组件
import { Dialog } from '@/components/ui/dialog'
```

---

## 📚 参考资源

### 官方文档

- [Next.js 16 Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Radix UI](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)

### 项目内部参考

- [lib/stores/](lib/stores/) - 状态管理示例
- [components/ui/](components/ui/) - UI 组件示例
- [components/chat/](components/chat/) - 业务组件示例
- [app/page.tsx](app/page.tsx) - 页面组件示例

---

## 🎯 快速检查清单

在提交代码前，确保:

- [ ] 所有文件使用 TypeScript (`.ts` 或 `.tsx`)
- [ ] 没有 `any` 类型 (或已添加注释说明)
- [ ] 组件定义了 Props 接口
- [ ] 使用 `@/` 路径别名 (不是相对路径)
- [ ] 使用 Tailwind classes (不是内联样式)
- [ ] 从 `components/ui/` 导入 UI 组件
- [ ] 从 `lib/stores/` 导入状态管理
- [ ] Server Component 除非需要交互才添加 `'use client'`
- [ ] 代码通过 `npm run lint` 检查
- [ ] 代码通过 `npx tsc --noEmit` 类型检查

---

**本文档由 AI 生成于 2025-01-14**
**版本**: 1.0.0
**维护者**: Context-OS 开发团队
