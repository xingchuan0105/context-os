# Context-OS 代码地图

本文提供代码库的快速导航指南。

## 目录结构

```
context-os/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── auth/          # 认证相关 API
│   │   │   ├── login/     # 登录
│   │   │   ├── register/  # 注册
│   │   │   ├── reset-password/     # 重置密码
│   │   │   ├── reset-request/      # 请求重置
│   │   │   └── verify-reset-token/ # 验证 Token
│   │   ├── chat/          # 聊天 API
│   │   ├── documents/     # 文档管理 API
│   │   ├── search/        # 搜索 API
│   │   └── sources/       # 来源管理 API
│   ├── (dashboard)/       # 主应用页面
│   │   ├── notebooks/     # 笔记本/知识库
│   │   ├── sources/       # 来源管理
│   │   └── ...
│   └── layout.tsx         # 根布局
├── lib/                   # 核心业务逻辑
│   ├── api/              # API 客户端和工具
│   ├── auth/             # 认证逻辑
│   │   ├── jwt.ts        # JWT 生成/验证
│   │   ├── password.ts   # 密码哈希
│   │   └── validation.ts # Zod 输入验证
│   ├── config/           # 配置
│   │   └── env-helpers.ts # 环境变量解析
│   ├── db/               # 数据库
│   │   ├── schema.ts     # 表结构定义
│   │   └── queries.ts    # 查询函数
│   ├── email/            # 邮件服务
│   │   └── index.ts      # SMTP 发送
│   ├── llm/              # LLM 调用
│   ├── processors/       # 文档处理器
│   │   ├── document-processor.ts      # 主处理流程
│   │   └── k-type-efficient-vercel.ts # K-Type 认知分析
│   ├── chunkers/         # 分块器
│   │   └── parent-child.ts # 父子分块
│   ├── rag/              # RAG 检索
│   │   └── retrieval.ts  # 检索逻辑
│   ├── queue/            # 任务队列 (BullMQ)
│   ├── storage/          # 存储层 (COS, Local)
│   ├── utils/            # 工具函数
│   │   └── file-validation.ts # 文件验证
│   ├── embedding.ts      # 向量嵌入
│   ├── qdrant.ts         # Qdrant 客户端
│   └── semchunk.ts       # 语义分块 (Python)
├── components/           # React 组件
│   ├── ui/               # 基础 UI 组件
│   ├── chat/             # 聊天组件
│   └── common/           # 通用组件
├── data/                 # SQLite 数据库文件
├── scripts/              # 工具脚本
├── tests/                # 测试文件
├── docker-compose.dev.yml    # Docker 开发环境
├── Dockerfile.backend        # 后端镜像
└── Dockerfile.worker         # Worker 镜像
```

---

## 快速导航

### 功能模块

| 功能 | 文件位置 |
|------|----------|
| 用户认证 | `lib/auth/`, `app/api/auth/` |
| 密码重置 | `app/api/auth/reset-*`, `lib/email/` |
| 数据库 Schema | `lib/db/schema.ts` |
| 数据库查询 | `lib/db/queries.ts` |
| 文档处理 | `lib/processors/document-processor.ts` |
| K-Type 分析 | `lib/processors/k-type-efficient-vercel.ts` |
| 父子分块 | `lib/chunkers/parent-child.ts` |
| 语义分块 | `lib/semchunk.ts` |
| RAG 检索 | `lib/rag/retrieval.ts` |
| LLM 调用 | `lib/llm/` |
| Embedding | `lib/embedding.ts` |
| 队列管理 | `lib/queue/` |
| 文件存储 | `lib/storage/` |
| 文件验证 | `lib/utils/file-validation.ts` |
| 邮件服务 | `lib/email/` |
| 环境配置 | `lib/config/env-helpers.ts` |

---

## 核心流程

### 用户注册流程
```
用户输入
  → app/api/auth/register/route.ts
    → lib/auth/validation.ts (Zod 验证)
    → lib/auth/password.ts (哈希)
    → lib/db/queries.ts (存储)
```

### 密码重置流程
```
请求重置
  → app/api/auth/reset-request/route.ts
    → lib/db/queries.ts (生成 Token)
    → lib/email/ (发送邮件)

验证 Token
  → app/api/auth/verify-reset-token/route.ts
    → lib/db/queries.ts (验证)

重置密码
  → app/api/auth/reset-password/route.ts
    → lib/auth/password.ts (哈希新密码)
    → lib/db/queries.ts (更新)
```

### 文档上传流程
```
文件上传
  → app/api/sources/route.ts
    → lib/utils/file-validation.ts (Magic Bytes 验证)
    → lib/parsers/ (解析文件内容)
    → lib/processors/document-processor.ts
      → lib/processors/k-type-efficient-vercel.ts (认知分析)
      → lib/semchunk.ts 或 lib/chunkers/parent-child.ts (分块)
      → lib/embedding.ts (向量化)
      → lib/qdrant.ts (存储向量)
```

### 聊天流程
```
用户消息
  → app/api/chat/sessions/[id]/messages/route.ts
    → lib/rag/retrieval.ts (检索相关内容)
      → lib/qdrant.ts (向量搜索)
    → lib/llm/ (调用 LLM)
    → 返回流式响应
```

---

## 环境变量

主要环境变量参见 `lib/config/env-helpers.ts`。

```typescript
// LLM 配置
LITELLM_BASE_URL
LITELLM_API_KEY
KTYPE_MODEL
EMBEDDING_MODEL
RERANKER_MODEL

// 数据库
DATABASE_URL
QDRANT_URL

// 队列
REDIS_HOST
REDIS_PORT

// 认证
JWT_SECRET
COOKIE_SECURE

// 邮件
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM

// 文档处理
KTYPE_MAX_TOKENS      // K-Type 最大 Token 数 (默认 500000)
KTYPE_MAX_CHARS       // K-Type 最大字符数 (默认 990000)
DOC_CHUNK_SIZE        // 文档块大小 (默认 2400)
DOC_CHUNK_OVERLAP     // 文档块重叠 (默认 300)
PARENT_CHUNK_SIZE     // 父块大小 (默认 1600)
```

---

## 前端项目

前端独立位于 `D:\context-os\context-os-clean-20260129-v3\frontend\`。

```
frontend/
├── src/
│   ├── app/              # Next.js 页面
│   ├── components/       # React 组件
│   ├── lib/              # 工具函数
│   │   ├── api/          # API 客户端
│   │   ├── auth/         # 认证工具
│   │   ├── hooks/        # React Hooks
│   │   └── ...
│   └── ...
```
