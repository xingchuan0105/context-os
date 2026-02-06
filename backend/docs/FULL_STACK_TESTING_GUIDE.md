# 全栈测试架构文档

> **目标**: 明确前端、API、后端的关系，评估全流程测试需求，确定是否需要临时性方案

---

## 📋 目录

- [架构概述](#架构概述)
- [数据流分析](#数据流分析)
- [核心模块详解](#核心模块详解)
- [现有测试覆盖](#现有测试覆盖)
- [测试需求评估](#测试需求评估)
- [临时方案建议](#临时方案建议)
- [推荐测试策略](#推荐测试策略)

---

## 🏗️ 架构概述

### 系统组成

```
┌─────────────────────────────────────────────────────────────┐
│                     Context-OS 系统                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐  │
│  │   Frontend   │──────│  API Routes  │──────│ Backend   │  │
│  │  (Next.js)   │      │  (App Router)│      │ Services  │  │
│  ��──────────────┘      └──────────────┘      └───────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              External Services                         │   │
│  │  • Qdrant (向量数据库)                                │   │
│  │  • OneAPI (LLM 网关)                                  │   │
│  │  • SiliconFlow (Embedding)                           │   │
│  │  • 腾讯云 COS (对象存储，可选)                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈分层

| 层级 | 技术 | 用途 |
|------|------|------|
| **Frontend** | Next.js 16.1.1 + React 19.2.3 | UI + 客户端逻辑 |
| **API** | Next.js App Router | API 路由 + Server Actions |
| **State** | Zustand 5.0.10 | 客户端状态管理 |
| **Database** | better-sqlite3 | 本地 SQLite 数据库 |
| **Vector DB** | Qdrant | 向量存储和检索 |
| **LLM** | OneAPI 统一网关 | LLM 调用 (DeepSeek, Qwen) |
| **Embedding** | SiliconFlow (BAAI/bge-m3) | 向量生成 |
| **Storage** | Local / 腾讯云 COS | 文件存储 |

---

## 🔄 数据流分析

### 1. 用户认证流程

```
┌──────────┐                  ┌──────────────┐
│  Login   │                  │   Database   │
│  Page    │──────────────────>│   (users)    │
└──────────┘                  └──────────────┘
     │                              │
     │ POST /api/auth/login         │
     v                              v
┌──────────────┐            ┌──────────────┐
│  API Route   │<───────────│  JWT Verify  │
│  (login.ts)  │            │  (session)   │
└──────────────┘            └──────────────┘
     │
     | Set auth_token cookie
     v
┌──────────────┐
│  Redirect    │
│  to /kb      │
└──────────────┘
```

**关键文件**:
- Frontend: [app/login/page.tsx](app/login/page.tsx)
- API: [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
- Session: [lib/auth/session.ts](lib/auth/session.ts)

---

### 2. 文档上传流程 (核心 RAG 流程)

```
┌──────────────┐
│  Frontend    │
│  Upload UI   │
└──────┬───────┘
       │ POST /api/documents
       │ FormData: file, kb_id, autoProcess
       v
┌───────────────────────────────────────────────┐
│  API: /api/documents/route.ts                │
│  1. 立即解析文件 (parseFile)                  │
│  2. 转换为 Markdown (formatAsMarkdown)       │
│  3. 存储 (本地或 COS)                         │
│  4. 创建数据库记录 (createDocument)           │
│  5. 触发后台处理 (processDocumentInBackground)│
└─────────────────┬─────────────────────────────┘
                  │
                  | setTimeout (异步，避免阻塞响应)
                  v
┌───────────────────────────────────────────────┐
│  后台处理: lib/processors/document-processor   │
│                                               │
│  1. K-Type 认知分析                          │
│     └─> lib/processors/k-type-efficient-vercel│
│         └─> OneAPI (Qwen Flash)              │
│                                               │
│  2. 父子分块                                 │
│     └─> lib/chunkers/parent-child.ts          │
│                                               │
│  3. 批量 Embedding                           │
│     └─> lib/embedding.ts                     │
│         └─> SiliconFlow (BAAI/bge-m3)        │
│                                               │
│  4. 三层写入 Qdrant                          │
│     └─> lib/qdrant.ts                        │
│         • 文档层 (K-Type 摘要)               │
│         • 父块层 (章节级)                    │
│         • 子块层 (细节级)                    │
│                                               │
│  5. 更新数据库状态                           │
│     └─> updateDocumentKType                  │
└───────────────────────────────────────────────┘
```

**关键文件**:
- Frontend: [lib/api/documents.ts](lib/api/documents.ts)
- API: [app/api/documents/route.ts](app/api/documents/route.ts)
- 处理器: [lib/processors/document-processor.ts](lib/processors/document-processor.ts)
- Qdrant: [lib/qdrant.ts](lib/qdrant.ts)

**数据流特点**:
1. **异步处理**: 上传后立即响应，后台异步处理
2. **状态追踪**: 数据库记录 `status` (pending → processing → completed/failed)
3. **三层向量**: document (摘要), parent (章节), child (细节)
4. **用户隔离**: 每个 User 独立 Qdrant collection (`user_{userId}_vectors`)

---

### 3. 聊天对话流程 (RAG 检索)

```
┌──────────────┐
│  Chat UI     │
│  (聊天界面)   │
└──────┬───────┘
       │ POST /api/chat/stream
       │ { message, kb_id, session_id }
       v
┌───────────────────────────────────────────────┐
│  API: /api/chat/stream/route.ts              │
│  1. 生成查询向量                             │
│     └─> lib/embedding.ts                     │
│         └─> SiliconFlow (BAAI/bge-m3)        │
│                                               │
│  2. 三层检索 (Drill-Down Search)             │
│     └─> lib/qdrant.ts                        │
│         • L1: 文档层 (K-Type 摘要)           │
│         • L2: 父块层 (找到相关章节)          │
│         • L3: 子块层 (获取具体内容)          │
│                                               │
│  3. 构建 Prompt + 上下文                    │
│     └─> 检索到的子块内容                     │
│                                               │
│  4. 流式生成回答                             │
│     └─> lib/llm-client.ts                    │
│         └─> OneAPI (DeepSeek Chat)           │
│         └─> SSE (Server-Sent Events)         │
└───────────────────────────────────────────────┘
       │
       | SSE Stream
       v
┌──────────────┐
│  Frontend    │
│  SSE Reader  │
└──────────────┘
```

**关键文件**:
- Frontend: [lib/api/chat.ts](lib/api/chat.ts) (假设存在)
- API: [app/api/chat/stream/route.ts](app/api/chat/stream/route.ts)
- Qdrant: [lib/qdrant.ts](lib/qdrant.ts) - `searchWithDrillDown` 方法
- LLM: [lib/llm-client.ts](lib/llm-client.ts)

**RAG 检索特点**:
1. **三层钻取**: 先找文档，再找章节，最后找具体内容
2. **语义检索**: 使用向量相似度 (Cosine distance)
3. **上下文增强**: 检索到的内容作为 LLM 上下文
4. **流式输出**: SSE 实时返回生成内容

---

## 🔧 核心模块详解

### Frontend (客户端)

**目录结构**:
```
app/
├── page.tsx                    # 主页 (知识库列表)
├── login/page.tsx              # 登录页
├── kb/[id]/
│   ├── page.tsx                # 知识库详情
│   └── chat/page.tsx           # 聊天页
└── api/                        # API 路由 (与后端共享)
components/
├── ui/                         # UI 组件 (shadcn/ui)
├── layout/                     # 布局组件
└── chat/                       # 聊天组件
lib/
├── stores/                     # Zustand 状态管理
│   ├── kb-store.ts             # 知识库状态
│   ├── chat-store.ts           # 聊天状态
│   └── document-store.ts       # 文档状态
├── api/                        # API 客户端
│   ├── client.ts               # 通用客户端 (fetch 封装)
│   ├── knowledge-base.ts       # KB API
│   ├── documents.ts            # 文档 API
│   └── chat.ts                 # 聊天 API
└── auth/
    └── session.ts              # 会话管理 (JWT)
```

**关键模式**:
1. **API 客户端模式**: 统一的错误处理和类型定义
   ```typescript
   // lib/api/knowledge-base.ts
   export const knowledgeBaseApi = {
     getAll: async () => {
       const response = await apiClient.get<KnowledgeBase[]>('/knowledge-bases')
       return response.data
     },
     // ...
   }
   ```

2. **Zustand 状态管理**: 简洁的全局状态
   ```typescript
   // lib/stores/kb-store.ts
   export const useKBStore = create<KBState>((set) => ({
     knowledgeBases: [],
     setKnowledgeBases: (kbs) => set({ knowledgeBases: kbs }),
     // ...
   }))
   ```

3. **Server/Client Components 分离**:
   - Server Component: 页面默认 (性能更好)
   - Client Component: 需要交互时加 `'use client'`

---

### API Routes (后端接口)

**路由清单**:
```
/api/
├── auth/
│   ├── login/route.ts          # 登录
│   ├── register/route.ts       # 注册
│   └── me/route.ts             # 获取当前用户
├── knowledge-bases/
│   └── route.ts                # GET (列表), POST (创建)
├── documents/
│   └── route.ts                # GET (列表), POST (上传)
├── chat/
│   ├── sessions/route.ts       # GET (会话列表), POST (创建)
│   └── stream/route.ts         # POST (流式聊天)
└── search/
    └── route.ts                # POST (搜索)
```

**关键模式**:
1. **错误处理包装器**: `withErrorHandler`
   ```typescript
   export const GET = withErrorHandler(async (req: NextRequest) => {
     const user = await getCurrentUser()
     if (!user) throw new UnauthorizedError('请先登录')
     // ...
   })
   ```

2. **认证中间件**: `getCurrentUser()`
   ```typescript
   const user = await getCurrentUser()
   if (!user) throw new UnauthorizedError()
   ```

3. **统一响应格式**:
   ```typescript
   return success(data)      // { success: true, data: ... }
   return success(data, 201) // 带状态码
   ```

---

### Backend Services (核心服务)

#### 1. 数据库服务 (lib/db/)

**技术**: better-sqlite3 (本地 SQLite)

**核心表**:
```sql
users                 -- 用户表
knowledge_bases       -- 知识库表
documents             -- 文档表 (存储元数据和 base64 内容)
chat_sessions         -- 聊天会话表
chat_messages         -- 聊天消息表
```

**特点**:
- 单文件数据库 (`./data/context-os.db`)
- 同步 API (性能好)
- 适合单机部署

#### 2. Qdrant 服务 (lib/qdrant.ts)

**功能**: 向量存储和检索

**核心 API**:
- `ensureUserCollection(userId)` - 确保用户的 collection 存在
- `upsertPoints(userId, points)` - 批量插入向量点
- `search(userId, queryVector, options)` - 向量搜索
- `searchWithDrillDown(...)` - **三层钻取检索** (核心)

**三层结构**:
```
user_{userId}_vectors Collection
├── type: 'document'  (K-Type 摘要)
├── type: 'parent'    (章节级父块)
└── type: 'child'     (细节级子块)
```

#### 3. LLM 客户端 (lib/llm-client.ts)

**架构**: OneAPI 统一网关

**模型配置**:
```typescript
{
  default: 'deepseek-chat',           // 主力模型
  deepseek_reasoner: 'deepseek-reasoner',  // 推理模型
  qwen_max: 'qwen-max',               // 最强模型
  qwen_flash: 'qwen-flash',           // 快速模型 (K-Type 分析)
}
```

**关键功能**:
- `chat()` - 非流式调用
- `chatStream()` - 流式调用 (带事件)
- `compareModels()` - 多模型对比测试

#### 4. 文档处理器 (lib/processors/document-processor.ts)

**完整流程**:
```
1. 解析文件 (parsePDF/DOCX/TXT)
   └─> lib/parsers/

2. K-Type 分析 (可选)
   └─> lib/processors/k-type-efficient-vercel.ts
       └─> OneAPI (Qwen Flash)

3. 父子分块
   └─> lib/chunkers/parent-child.ts

4. 批量 Embedding
   └─> lib/embedding.ts
       └─> SiliconFlow (BAAI/bge-m3)

5. 三层写入 Qdrant
   └─> lib/qdrant.ts
       ├── 文档层 (K-Type 摘要)
       ├── 父块层 (章节)
       └── 子块层 (细节)

6. 更新数据库
   └─> lib/db/queries.ts
```

**性能优化**:
- 批量 Embedding (batch size = 10)
- 分批插入 Qdrant (batch size = 500)
- 异步处理 (setTimeout 避免阻塞)

#### 5. Embedding 服务 (lib/embedding.ts)

**提供商**: SiliconFlow

**模型**: BAAI/bge-m3 (1024 维)

**配置**:
```env
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_TIMEOUT_MS=120000
```

---

## 🧪 现有测试覆盖

### 测试脚本清单

根据 [package.json](package.json) 和 `scripts/` 目录：

#### 基础设施测试
- `check-api.ts` - API 基础检查
- `check-db.ts` - 数据库检查
- `check-qdrant.ts` - Qdrant 连接检查

#### 单元测试
- `test-llm-simple.ts` - LLM 客户端测试
- `test-new-qdrant-api.ts` - Qdrant API 测试
- `test-e2e-pipeline.ts` - **端到端 RAG 流程测试** ⭐

#### 集成测试
- `full-pipeline-test.ts` - 完整文档处理流程测试
- `test-three-layer.ts` - 三层检索测试
- `end-to-end-rag-test.ts` - **完整的 RAG 测试** (含 HTTP API) ⭐

#### 性能测试
- `test-performance/` 目录
  - `response` - 响应时间测试
  - `load` - 负载测试
  - `memory` - 内存测试
  - `stress` - 压力测试

### 现有测试覆盖情况

| 测试类型 | 覆盖率 | 说明 |
|---------|--------|------|
| **前端组件** | ❌ 无 | 无 React 组件测试 |
| **API 路由** | ⚠️ 部分 | 有 HTTP 测试，但不完整 |
| **后端服务** | ✅ 完整 | LLM、Embedding、Qdrant 均有测试 |
| **RAG 流程** | ✅ 完整 | 端到端测试覆盖完整流程 |
| **数据库** | ⚠️ 部分 | 有检查脚本，无单元测试 |
| **性能测试** | ✅ 完整 | 有完整性能测试套件 |

**最完整的测试**: [scripts/end-to-end-rag-test.ts](scripts/end-to-end-rag-test.ts)

这个脚本测试了完整的流程：
1. 创建测试用户和知识库
2. 上传 test.pdf
3. 等待文档处理完成
4. 运行 RAG 召回测试

---

## 🎯 测试需求评估

### 问题 1: 需要临时性方案吗？

**答案**: ❌ **不需要搭建新的临时方案**

**理由**:
1. **完整的测试环境已存在**: `scripts/end-to-end-rag-test.ts` 已经实现了完整的端到端测试
2. **本地开发环境已就绪**:
   - 数据库: 本地 SQLite (`./data/context-os.db`)
   - Qdrant: Docker 或本地服务
   - LLM: OneAPI (可本地部署)
   - Embedding: SiliconFlow API (外部服务)
3. **前后端一体化**: Next.js API Routes 与前端在同一进程中

### 问题 2: 现有测试的不足

**主要缺陷**:

1. **前端组件测试缺失**
   - ❌ 无 React 组件测试
   - ❌ 无状态管理测试 (Zustand stores)
   - ❌ 无 API 客户端单元测试

2. **API 路由测试不完整**
   - ⚠️ 缺少错误场景测试
   - ⚠️ 缺少认证测试
   - ⚠️ 缺少并发测试

3. **集成测试覆盖不足**
   - ⚠️ 前后端集成测试缺失
   - ⚠️ E2E 测试缺少浏览器自动化 (Playwright/Cypress)

### 问题 3: 测试环境依赖

**必需的外部服务**:

| 服务 | 用途 | 是否必需 | 替代方案 |
|------|------|---------|---------|
| **Qdrant** | 向量数据库 | ✅ 必需 | Docker / 本地服务 |
| **OneAPI** | LLM 网关 | ✅ 必需 | 本地部署 / 直连 |
| **SiliconFlow** | Embedding | ✅ 必需 | 无免费替代 |
| **腾讯云 COS** | 文件存储 | ❌ 可选 | 本地存储模式 |

**本地存储模式**:
```typescript
// lib/storage/local.ts
export function shouldUseLocalStorage(): boolean {
  return !process.env.TENCENT_COS_SECRET_ID
}
```

**测试环境配置建议**:
```env
# .env.test
DATABASE_URL=./data/test.db

# Qdrant (本地 Docker)
QDRANT_URL=http://localhost:6333

# OneAPI (本地部署)
ONEAPI_BASE_URL=http://localhost:3000/v1
ONEAPI_API_KEY=sk-test-key

# SiliconFlow (真实 API，不可省略)
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1

# 使用本地存储
# TENCENT_COS_SECRET_ID= (不配置)
```

---

## 🚀 临时方案建议

### 方案 1: 最小化测试环境 (推荐)

**适用场景**: 本地开发和 CI/CD

**组成部分**:
1. ✅ Docker Qdrant (一键启动)
2. ✅ 本地 SQLite (无需额外服务)
3. ✅ OneAPI 本地部署 (可选，或使用 Docker)
4. ✅ SiliconFlow Embedding (外部 API，需要密钥)

**启动步骤**:
```bash
# 1. 启动 Qdrant
docker run -p 6333:6333 qdrant/qdrant

# 2. 启动 OneAPI (可选)
# 使用 Docker 镜像或本地编译

# 3. 配置环境变量
cp .env.example .env.test
# 编辑 .env.test，填入必要密钥

# 4. 运行测试
npm run test:e2e
```

**优点**:
- 最小化依赖
- 快速启动
- 足够覆盖核心流程

**缺点**:
- 依赖外部 Embedding API
- OneAPI 配置较复杂

---

### 方案 2: Mock 测试环境 (轻量级)

**适用场景**: 单元测试和快速验证

**策略**: Mock 所有外部服务

**技术选择**:
- 使用 `vi.mock()` (Vitest) 或 `jest.mock()` (Jest)
- Mock Qdrant、OneAPI、SiliconFlow

**示例**:
```typescript
// vi.mock('@/lib/qdrant')
import { vi } from 'vitest'

vi.mock('@/lib/qdrant', () => ({
  search: vi.fn().mockResolvedValue([
    { id: 1, score: 0.9, payload: { content: 'mock content' } }
  ]),
  upsertPoints: vi.fn(),
}))
```

**优点**:
- 无需外部服务
- 测试速度快
- 适合 CI/CD

**缺点**:
- 无法测试真实集成
- Mock 数据可能与实际不符

---

### 方案 3: Docker Compose 完整环境 (生产级)

**适用场景**: 完整集成测试和演示

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"

  oneapi:
    image: ghproxy.cn/https://github.com/songquanpeng/one-api
    ports:
      - "3000:3000"
    environment:
      - SQL_DSN=sqlite:///data/oneapi.db

  app:
    build: .
    ports:
      - "3001:3000"
    depends_on:
      - qdrant
      - oneapi
    environment:
      - QDRANT_URL=http://qdrant:6333
      - ONEAPI_BASE_URL=http://oneapi:3000/v1
```

**启动**:
```bash
docker-compose up -d
```

**优点**:
- 完整的生产环境模拟
- 一键启动所有服务
- 适合演示和完整测试

**缺点**:
- 资源消耗大
- 启动较慢
- 配置复杂

---

## ✅ 推荐测试策略

### 短期 (立即实施)

**1. 运行现有端到端测试**
```bash
npm run test:e2e
# 或
tsx scripts/end-to-end-rag-test.ts
```

**2. 验证环境配置**
```bash
# 检查 Qdrant
npm run test:qdrant

# 检查数据库
npm run check:db

# 检查 API
npm run check:api
```

**3. 手动测试关键流程**
- 用户注册/登录
- 上传 PDF 文档
- 等待处理完成
- 聊天对话测试

---

### 中期 (补充测试)

**1. 添加前端组件测试**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**示例**:
```typescript
// __tests__/components/KBCard.test.tsx
import { render, screen } from '@testing-library/react'
import { KBCard } from '@/components/KBCard'

test('renders knowledge base card', () => {
  render(<KBCard kb={{ id: '1', title: 'Test KB' }} />)
  expect(screen.getByText('Test KB')).toBeInTheDocument()
})
```

**2. 补充 API 路由测试**
```typescript
// __tests__/api/knowledge-bases.test.ts
import { GET, POST } from '@/app/api/knowledge-bases/route'
import { NextRequest } from 'next/server'

test('GET /api/knowledge-bases returns list', async () => {
  const request = new NextRequest('http://localhost:3000/api/knowledge-bases')
  const response = await GET(request)
  const data = await response.json()
  expect(data.success).toBe(true)
})
```

**3. 添加集成测试**
```bash
npm install -D playwright
```

```typescript
// tests/e2e/upload-doc.spec.ts
import { test, expect } from '@playwright/test'

test('upload document flow', async ({ page }) => {
  await page.goto('http://localhost:3001/kb/test-kb')
  await page.click('text=Upload Document')
  await page.setInputFiles('input[type="file"]', 'test.pdf')
  await page.click('button:has-text("Upload")')
  await expect(page.locator('text=Processing')).toBeVisible()
})
```

---

### 长期 (完善测试体系)

**1. 建立 CI/CD 流程**
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
```

**2. 性能监控**
- 集成现有性能测试脚本
- 设置性能基准
- 监控回归

**3. 测试覆盖率目标**
- 单元测试: >80%
- 集成测试: 覆盖核心流程
- E2E 测试: 覆盖用户关键路径

---

## 📊 测试检查清单

### 环境准备

- [ ] Qdrant 服务运行中 (`docker run -p 6333:6333 qdrant/qdrant`)
- [ ] `.env` 文件配置完整
- [ ] 数据库初始化 (`npm run db:migrate`)
- [ ] OneAPI 服务运行 (可选)
- [ ] SiliconFlow API 密钥有效

### 核心功能测试

- [ ] **用户认证**
  - [ ] 注册新用户
  - [ ] 登录
  - [ ] 登出
  - [ ] 会话持久化

- [ ] **知识库管理**
  - [ ] 创建知识库
  - [ ] 查看知识库列表
  - [ ] 删除知识库
  - [ ] 更新知识库

- [ ] **文档上传**
  - [ ] 上传 PDF 文件
  - [ ] 上传 DOCX 文件
  - [ ] 上传 TXT 文件
  - [ ] 查看上传状态
  - [ ] 等待处理完成

- [ ] **RAG 处理**
  - [ ] K-Type 分析完成
  - [ ] 父子分块完成
  - [ ] 向量生成完成
  - [ ] Qdrant 写入完成
  - [ ] 数据库状态更新

- [ ] **搜索功能**
  - [ ] 关键词搜索
  - [ ] 语义搜索
  - [ ] 三层检索

- [ ] **聊天功能**
  - [ ] 创建会话
  - [ ] 发送消息
  - [ ] 流式接收响应
  - [ ] 查看历史消息
  - [ ] 引用文档内容

### 性能测试

- [ ] 文档上传速度 (10MB PDF < 30s)
- [ ] RAG 处理速度 (10页 PDF < 2min)
- [ ] 搜索响应时间 (< 1s)
- [ ] 聊天首字时间 (TTFB < 2s)
- [ ] 并发用户支持 (> 10)

---

## 🎯 总结与建议

### 核心发现

1. **✅ 架构清晰**: 前端、API、后端分层明确，职责清晰
2. **✅ 完整流程**: 从文档上传到 RAG 检索的完整链路已实现
3. **✅ 测试基础**: 有完整的端到端测试脚本
4. **⚠️ 前端测试缺失**: 无 React 组件测试
5. **⚠️ 依赖外部服务**: Qdrant、OneAPI、SiliconFlow

### 建议

**对于本地开发**:
1. 使用 Docker 启动 Qdrant
2. 使用本地 SQLite 数据库
3. 使用本地存储模式 (不配置 COS)
4. 运行 `npm run test:e2e` 验证环境

**对于 CI/CD**:
1. 使用 Docker Compose 启动完整环境
2. Mock 部分外部服务 (可选)
3. 运行核心测试套件

**对于生产部署**:
1. 使用云端 Qdrant (腾讯云/阿里云)
2. 使用腾讯云 COS 存储文件
3. 配置 OneAPI 负载均衡
4. 监控性能和错误

### 无需搭建临时方案的理由

1. **现有测试已完整**: `end-to-end-rag-test.ts` 覆盖全流程
2. **环境已就绪**: Docker Qdrant + 本地 SQLite 即可
3. **前后端一体化**: Next.js API Routes 无需单独部署
4. **快速验证**: `npm run test:e2e` 一键运行

---

**文档版本**: 1.0.0
**生成日期**: 2025-01-14
**维护者**: Context-OS Team
