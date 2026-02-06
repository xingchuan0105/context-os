# Context-OS 最新版项目文档（基于本地代码快照 2026-01-29）

## 0. 范围与目录（干净工作区 v3）
- 后端 / 全栈：`D:\context-os\context-os-clean-20260129-v3\backend`（Next.js App Router + API）
- 前端（独立 UI）：`D:\context-os\context-os-clean-20260129-v3\frontend`（Next.js App Router）
- 旧前端快照（原位置）：`D:\context-os\context-os-frontend-new`（较旧，建议归档）
- 部署/归档（原位置）：`D:\context-os\context-os-deploy`、`D:\context-os\context-os-deploy-ready`、`D:\context-os\archives`

> 本文档以“干净工作区 v3”为当前主线版本。

## 1. 系统概览
Context-OS 是基于 RAG 的知识管理系统，核心链路为：文档上传与解析 → K-Type 认知分析 → 三层向量检索 → LLM 生成回答（含引用）。

```
Browser
  │
  ▼
Frontend (Next.js)  ───────────────┐
  │                                 │
  ▼                                 │
Backend API (Next.js)               │
  │                                 │
  ├─ SQLite (元数据/会话/用户)       │
  ├─ Qdrant (向量检索)               │
  ├─ Redis + BullMQ (异步队列)       │
  └─ LiteLLM (LLM/Embedding/Rerank)  │
            ▲
            │
         Worker (文档处理)
```

## 2. 技术栈
### 2.1 后端（backend）
- Next.js 16.1.1（App Router）
- React 19.2.3 + TypeScript 5.x
- SQLite（better-sqlite3，WAL 模式）
- Qdrant（向量数据库）
- Redis + BullMQ（异步队列）
- LiteLLM + OpenAI SDK（统一模型调用）

### 2.2 前端（frontend）
- Next.js 16.1.3（App Router）
- React 19.2.3 + TypeScript 5.x
- Tailwind CSS 4 + Radix UI / shadcn/ui
- Zustand（状态管理）
- TanStack Query（数据缓存）
- Axios（API 调用）

## 3. 目录结构（关键）
### 3.1 后端 `backend`
- `app/`：页面与 API 路由
- `lib/`：核心业务逻辑（auth/db/rag/processor/queue/storage/llm/sse）
- `scripts/`：测试/运维/性能工具
- `functions/document-processor/`：独立文档处理函数
- `docs/`：历史与专项文档

### 3.2 前端 `frontend`
- `src/app/(auth)`：登录/注册/重置密码
- `src/app/(dashboard)`：知识库、来源、搜索、模型、设置等
- `src/components/`：UI 与功能组件
- `src/lib/`：API 客户端、hooks、stores、types、utils

## 4. 核心模块说明（基于代码）
### 4.1 认证与会话
- JWT 存储于 httpOnly Cookie `auth_token`。
- 密码：PBKDF2-SHA256（600,000 迭代）。
- 重置密码：`users.reset_token` + `users.reset_token_expires_at`。

### 4.2 文档/来源处理流水线
- 上传 → 解析（PDF/DOCX/TXT/Markdown/Web）
- K-Type 认知摘要（可分段）
- 父子分块（parent/child chunk）
- Embedding（默认 `qwen3-embedding-4b`）
- 写入 Qdrant（按用户分 collection：`user_{userId}_vectors`）
- 更新 SQLite 状态（`documents.status/ktype_summary/deep_summary`）

### 4.3 RAG 检索（三层）
- 文档层：检索 K-Type 摘要
- 父块层：定位相关章节
- 子块层：定位细节段落
- 可选 rerank（LiteLLM `/rerank`）
- 文档路由：LLM 先筛选候选文档

### 4.4 聊天与上下文
- SSE 流式返回（`/api/chat/stream`）
- 会话与消息存储：`chat_sessions` / `chat_messages`
- 引用生成：基于检索结果拼装 citations

### 4.5 知识库/笔记/分享
- Knowledge Bases（知识库）+ Notebooks（兼容层）
- Notes / Quick Notes
- 文档分享 / 知识库分享（token 机制）

## 5. 数据模型（SQLite）
主要表：
- `users`（用户）
- `knowledge_bases`（知识库）
- `documents`（文档）
- `document_notebooks`（文档-知识库关系）
- `notes` / `quick_notes`
- `chat_sessions` / `chat_messages` / `chat_message_feedback`
- `document_shares` / `knowledge_base_shares` / `document_comments`

## 6. API 概览（按模块）
### 6.1 运行时配置
- `GET /config`：提供版本、DB 状态、更新信息（供前端启动时探测）

### 6.2 认证
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/reset-request`
- `POST /api/auth/verify-reset-token`
- `POST /api/auth/reset-password`

### 6.3 知识库 / 笔记本
- `GET|POST /api/knowledge-bases`
- `GET|PATCH|DELETE /api/knowledge-bases/[id]`
- `POST /api/knowledge-bases/[id]/share`
- `PATCH|DELETE /api/knowledge-bases/[id]/share/[shareId]`
- `GET|POST /api/notebooks`（兼容层）
- `GET|PATCH|DELETE /api/notebooks/[id]`
- `POST /api/notebooks/[id]/sources/[sourceId]`

### 6.4 文档 / 来源
- `GET|POST /api/documents`
- `GET|PATCH|DELETE /api/documents/[id]`
- `GET /api/documents/[id]/status`
- `POST /api/documents/[id]/reprocess`
- `POST /api/documents/[id]/share`
- `GET|POST /api/documents/[id]/comments`

- `GET|POST /api/sources`（兼容层：notebook_id/kb_id）
- `GET|PATCH|DELETE /api/sources/[id]`
- `GET /api/sources/[id]/status`
- `POST /api/sources/[id]/retry`
- `GET /api/sources/[id]/download`

### 6.5 聊天与检索
- `POST /api/chat/stream`（SSE）
- `POST /api/chat/context`（RAG 上下文）
- `GET|POST /api/chat/sessions`
- `GET|PATCH|DELETE /api/chat/sessions/[id]`
- `GET|POST /api/chat/sessions/[id]/messages`
- `GET|POST /api/chat/sessions/[id]/messages-v2`
- `POST /api/chat/messages/[id]/feedback`

### 6.6 搜索、笔记、分享
- `GET /api/search`
- `GET|POST /api/notes` / `GET|PATCH|DELETE /api/notes/[id]`
- `GET|POST /api/quick-notes` / `GET|PATCH|DELETE /api/quick-notes/[id]`
- `POST /api/quick-notes/[id]/promote` / `GET /api/quick-notes/summary` / `POST /api/quick-notes/chat`
- `GET /api/shared/[token]`、`/sources`、`/source-ids`、`/notes`

### 6.7 其他
- `GET /api/metrics`
- `GET /api/health`
- `GET /api/storage/stats` / `POST /api/storage/cache`
- `GET /api/user/profile`

## 7. 配置与环境变量（关键）
后端关键变量（`backend/.env.example`）：
- 数据：`DATABASE_URL`, `QDRANT_URL`
- 队列：`REDIS_HOST`, `REDIS_PORT`
- 认证：`JWT_SECRET`, `COOKIE_SECURE`
- 模型：`LITELLM_BASE_URL`, `LITELLM_API_KEY`, `EMBEDDING_MODEL`, `RERANK_MODEL`
- K-Type/分块：`KTYPE_*`, `DOC_CHUNK_SIZE`, `DOC_CHUNK_OVERLAP`, `PARENT_CHUNK_SIZE`
- 上传限制：`UPLOAD_MAX_BYTES`, `UPLOAD_CONCURRENCY_LIMIT`, `UPLOAD_RATE_LIMIT_*`
- 邮件：`SMTP_*`
- COS：`TENCENT_COS_*`

前端关键变量（`frontend/.env.local`）：
- `NEXT_PUBLIC_API_URL`（默认 `http://localhost:3002`）
- 前端通过 `/config` 读取运行时配置，优先级：runtime > env > smart default
- 前端自身也提供 `/config`（返回 `apiUrl`/版本/后端可达性），并通过 `next.config.ts` 将 `/api/*` 重写到后端

## 8. 本地运行
### 8.1 Docker（推荐）
```
cd D:\context-os\context-os-clean-20260129-v3\backend
docker-compose -f docker-compose.dev.yml up -d
```
默认端口：
- Backend API：`http://localhost:3002`
- Frontend：`http://localhost:3003`
- LiteLLM：`http://localhost:4410`
- Qdrant：宿主机 `16333`（容器内 `6333`）

### 8.2 非 Docker
1) 启动 Qdrant / Redis / LiteLLM
2) 后端：
```
cd D:\context-os\context-os-clean-20260129-v3\backend
npm install
npm run dev   # 默认 3000
```
3) 前端（另一个终端）：
```
cd D:\context-os\context-os-clean-20260129-v3\frontend
npm install
npm run dev   # 默认 3000，需选择 3001 或手动指定
```

### 8.3 Worker
```
cd D:\context-os\context-os-clean-20260129-v3\backend
npm run worker
```

## 9. 测试与脚本
后端常用：
- `npm run test`（综合）
- `npm run test:integration` / `test:perf:*` / `test:e2e` 等
- `npm run typecheck`, `npm run lint`, `npm run selfcheck`

前端常用：
- `npm run test:e2e`（Playwright）

## 10. 已知问题与建议
- 历史文档存在编码显示问题（已在干净工作区统一为 UTF-8）。
- 原目录中存在多个前端版本，建议仅保留 `context-os-front-end` 并归档旧目录。
- `/config` 版本号为静态值（0.1.0），如需真实版本需接入 CI/CD。

## 11. 版本信息
- Backend `package.json`：`0.1.0`
- Frontend `package.json`：`0.1.0`
- 文档日期：2026-01-29
