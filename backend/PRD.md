<style>
</style>

# 产品需求文档 (PRD) - Context OS v2.0

**更新日期**: 2025-01-12
**版本**: 2.0 (腾讯云全家桶架构)

---

## 1. 项目概述 (Project Overview)

### 1.1 产品愿景 (TL;DR)

**Context OS** 是一个企业级知识资产管理与深加工平台，采用 **腾讯云全家桶架构**，实现计算与存储的最优组合。通过 **DeepK** 深度认知流水线，将传统"文件堆放处"升级为"意图发射台"。

### 1.2 核心技术决策

| 决策点 | 选择 | 原因 |
|-------|------|------|
| **云厂商** | 腾讯云 | 统一控制台，内网互通，运维简单 |
| **前端部署** | 轻量应用服���器 Lighthouse | 开箱即用，性价比高 |
| **向量库** | Qdrant (预装轻量服务器) | 专用向量数据库，性能强 |
| **元数据库** | SQLite (本地) | 零配置，资源占用低 |
| **文件存储** | 腾讯云 COS | 对象存储，稳定可靠 |
| **消息队列** | 腾讯云 TDMQ | 兼容 Kafka，按需付费 |
| **函数计算** | 腾讯云 SCF | Serverless，按量计费 |
| **认证** | 自建 (JWT + SQLite) | 简化依赖，完全掌控 |

### 1.3 架构图

```
╔═══════════════════════════════════════════════════════════════╗
║                    Context OS 技术架构 v2.0                     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                 ║
║  ┌─────────────────────────────────────────────────────────┐  ║
║  │                      用户层                              │  ║
║  │                   Web 浏览器 / 移动端                     │  ║
║  └──────────────────────────┬──────────────────────────────┘  ║
║                             │                                ║
║  ┌──────────────────────────▼──────────────────────────────┐  ║
║  │                    前端层 (Lighthouse)                  │  ║
║  │  ┌──────────────────────────────────────────────────┐  │  ║
║  │  │         Next.js 15 (React 19)                     │  │  ║
║  │  │  - 页面渲染、路由、状态管理                         │  │  ║
║  │  │  - 部署: 腾讯云轻量应用服务器 (2C2G, ¥50/月)       │  │  ║
║  └──────────────────────────┬──────────────────────────────┘  ║
║                             │                                ║
║  ┌──────────────────────────▼──────────────────────────────┐  ║
║  │                    API 层                                │  ║
║  │  ���──────────────────────────────────────────────────┐  │  ║
║  │  │  Next.js API Routes                               │  │  ║
║  │  │  - /api/documents   (上传、列表、删除)              │  │  ║
║  │  │  - /api/search       (三层钻取检索)                │  │  ║
║  │  │  - /api/callback     (处理完成回调)                 │  │  ║
║  │  └──────────────────────────────────────────────────┘  │  ║
║  └──────────────────────────┬──────────────────────────────┘  ║
║                             │                                ║
║         ┌───────────────────┼───────────────────┐              ║
║         ▼                   ▼                   ▼              ║
║  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           ║
║  │  腾讯云    │   │  腾讯云     │   │  腾讯云     │           ║
║  │   COS     │   │   TDMQ      │   │   SCF       │           ║
║  │ (文件存储) │   │ (消息队列)   │   │ (函数计算)  │           ║
║  └──────┬─────┘   └──────┬─────┘   └──────┬─────┘           ║
║         │                │                │                  ║
║  ┌──────▼────────────────▼────────────────▼─────┐             ║
║  │            文档处理流程 (SCF 函数)           │             ║
║  │  1. 从 COS 下载文件                          │             ║
║  │  2. 解析 (PDF/DOCX/TXT)                      │             ║
║  │  3. K-Type 认知分析 (调用 LLM)               │             ║
║  │  4. 父子分块                                  │             ║
║  │  5. 批量生成嵌入向量                         │             ║
║  │  6. 写入 Qdrant                               │             ║
║  │  7. 更新 SQLite (元数据)                      │             ║
║  └────────────────────────┬─────────────────────┘             ║
║                             │                                ║
║  ┌──────────────────────────▼──────────────────────────────┐  ║
║  │                    存储层                                │  ║
║  │  ┌──────────────────────────────────────────────────┐  │  ║
║  │  │  Qdrant (向量数据库)                             │  │  ║
║  │  │  - 存储: 1024维向量 (bge-m3)                     │  │  ║
║  │  │  - 部署: 腾讯云轻量服务器 (预装, 2C2G)           │  │  ║
║  │  │  - 容量: 10-100万向量 / 1-10GB                   │  │  ║
║  │  └──────────────────────────────────────────────────┘  │  ║
║  │  ┌──────────────────────────────────────────────────┐  │  ║
║  │  │  SQLite (元数据库)                              │  │  ║
║  │  │  - 部署: 前端服务器本地                            │  │  ║
║  │  │  - 存储: 文档元数据、处理状态、用户配置           │  │  ║
║  │  │  - 备份: 每日自动备份到 COS                       │  │  ║
║  │  └──────────────────────────────────────────────────┘  │  ║
║  └───────────────────────────────────────────────────────┘  ║
║                                                                 ║
║  ┌─────────────────────────────────────────────────────────┐  ║
║  │                    外部服务                              │  ║
║  │  ┌────────────────┐  ┌────────────────┐               │  ║
║  │  │   OneAPI      │  │   LLM API      │               │  ║
║  │  │ (LLM 网关)     │  │ (DeepSeek/等)  │               │  ║
║  └──────────┘  └────────────────┘  └────────────────┘               │  ║
║  │  ┌────────────────┐  ┌────────────────┐               │  ║
║  │  │  Embedding API │  │  域名/SSL     │               │  ║
║  │  │ (向量生成)     │  │                │               │  ║
║  └────────────────┘  └────────────────┘               │  ║
║  └─────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 2. 技术栈选型 (Technology Stack)

### 2.1 前端技术栈

| 技术 | 版本/说明 | 用途 |
|-----|----------|------|
| **Next.js** | 15+ (App Router) | 全栈框架 |
| **React** | 19 | UI 库 |
| **TypeScript** | 5+ | 类型安全 |
| **Tailwind CSS** | 4+ | 样式 |
| **Lucide React** | 最新 | 图标库 |

### 2.2 后端技术栈

| 技术 | 版本/说明 | 用途 |
|-----|----------|------|
| **Next.js API Routes** | App Router | 后端 API |
| **SQLite** | 3.x | 元数据库 |
| **better-sqlite3** | 最新 | SQLite 驱动 |
| **Jose** | 最新 | JWT 签发/验证 |

### 2.3 AI & 向量技术栈

| 技术 | 版本/说明 | 用途 |
|-----|----------|------|
| **Qdrant** | v1.13+ | 向量数据库 |
| **@qdrant/js-client-rest** | 最新 | Qdrant 客户端 |
| **OneAPI** | 最新 | LLM 网关 |
| **BAAI/bge-m3** | 最新 | Embedding 模型 (1024维) |

### 2.4 腾讯云服务

| 服务 | 规格 | 月成本 | 用途 |
|-----|------|-------|------|
| **轻量应用服务器 A** | 2C2G, 50GB SSD | ¥50 | Next.js + SQLite |
| **轻量应用服务器 B** | 2C2G, 50GB SSD, 预装 Qdrant | ¥70 | 向量数据库 |
| **COS 对象存储** | 标准存储 | ¥10-20 | 文件存储 + 备份 |
| **TDMQ 消息队列** | | ¥20-30 | 异步消息 |
| **SCF 函数计算** | 按量付费 | ¥50-100 | 文档处理 |
| **域名 + SSL** | | ¥10-50 | HTTPS 访问 |
| **总计** | | **~¥210-370/月** | |

---

## 3. 核心功能需求 (Functional Requirements)

### 3.1 三层检索策略

**检索流程**：文档级 → 父块级 → 子块级

| 层级 | 内容 | 向量来源 | 用途 |
|-----|------|---------|------|
| **文档层** | K-Type 认知摘要 | ktype_summary | 找到相关文档 |
| **父块层** | 章节内容 | parent_content | 找到相关章节 |
| **子块层** | 细节内容 | child_content | 找到具体内容 |

### 3.2 文档处理流程

```
用户上传 → COS存储 → TDMQ消息 → SCF函数处理 → Qdrant入库 → SQLite更新状态
```

**处理步骤**：
1. 下载文件 (COS)
2. 解析内容 (PDF/DOCX/TXT)
3. K-Type 分析 (LLM)
4. 父子分块
5. 批量嵌入
6. 写入 Qdrant (三层向量)
7. 更新 SQLite

### 3.3 认证与权限

**采用自建 JWT 认证**：
- 注册/登录邮箱密码
- JWT Token 存储在 httpOnly Cookie
- SQLite users 表存储用户信息
- 数据隔离通过 user_id 实现

---

## 4. 数据模型 (Data Schema)

### 4.1 SQLite 数据库结构

```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 知识库表
CREATE TABLE knowledge_bases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 文档表
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  kb_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  status TEXT DEFAULT 'queued',  -- queued, processing, completed, failed
  error_message TEXT,

  -- K-Type 结果
  ktype_summary TEXT,
  ktype_metadata TEXT,  -- JSON 格式
  deep_summary TEXT,    -- JSON 格式
  chunk_count INTEGER DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 笔记表
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  kb_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT 0,
  share_token TEXT UNIQUE,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 聊天会话表
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  kb_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 聊天消息表
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- user, assistant
  content TEXT NOT NULL,
  citations TEXT,  -- JSON 格式
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_documents_kb ON documents(kb_id);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_notes_share ON notes(share_token) WHERE is_shared = 1;
```

### 4.2 Qdrant 数据结构

**Collection 命名**：`user_{userId}_vectors`

**Point Payload**：
```typescript
interface ChunkPayload {
  doc_id: string
  kb_id: string
  user_id: string
  type: 'document' | 'parent' | 'child'
  parent_id?: number
  content: string
  chunk_index: number
  metadata?: {
    file_name?: string
    ktype?: { dominant_type?: string; knowledge_modules?: string[] }
    parent_index?: number
  }
}
```

---

## 5. API 设计

### 5.1 认证 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/auth/me` | GET | 获取当前用户 |

### 5.2 文档 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/documents` | POST | 上传文档 |
| `/api/documents` | GET | 获取文档列表 |
| `/api/documents/:id` | GET | 获取文档详情 |
| `/api/documents/:id` | DELETE | 删除文档 |
| `/api/documents/:id/status` | GET | 获取处理状态 |

### 5.3 搜索 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/search` | POST | 三层钻取检索 |

**请求体**：
```json
{
  "query": "搜索内容",
  "userId": "user-123",
  "kbId": "kb-123",
  "mode": "drill-down",  // drill-down | drill-down-relaxed | flat
  "topK": 5
}
```

**响应体**：
```json
{
  "mode": "drill-down",
  "context": {
    "document": { "summary": "...", "score": 0.85 },
    "parent": { "content": "...", "score": 0.82 },
    "children": [
      { "content": "...", "score": 0.80 }
    ]
  }
}
```

### 5.4 回调 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/callback/document` | POST | SCF 处理完成回调 |

---

## 6. 部署清单

### 6.1 腾讯云资源购买

1. **轻量应用服务器 A** (前端 + SQLite)
   - 镜像：Node.js 18/20
   - 规格：2核2G
   - 存储：50GB SSD

2. **轻量应用服务器 B** (Qdrant 预装)
   - 镜像：Qdrant
   - 规格：2核2G
   - 存储：50GB SSD

3. **COS 对象存储**
   - 创建存储桶：context-os-documents
   - 权限：私有读写

4. **TDMQ 消息队列**
   - 创建队列：context-doc-process
   - 消息保留时间：3天

5. **SCF 函数计算**
   - 创建函数：document-processor
   - 运行时：Node.js 20
   - 触发器：TDMQ 队列

### 6.2 环境变量配置

**前端服务器**：
```bash
# 数据库
DATABASE_URL=/data/context-os.db

# JWT
JWT_SECRET=your-secret-key

# 腾讯云
TENCENT_COS_SECRET_ID=xxx
TENCENT_COS_SECRET_KEY=xxx
TENCENT_COS_BUCKET=context-os-documents

# Qdrant
QDRANT_URL=http://qdrant-server-ip:6333

# OneAPI
ONEAPI_BASE_URL=http://your-oneapi
ONEAPI_KEY=sk-xxx

# Embedding
EMBEDDING_MODEL=BAAI/bge-m3
```

**SCF 函数**：
```bash
# 腾讯云 COS
TENCENT_COS_SECRET_ID=xxx
TENCENT_COS_SECRET_KEY=xxx
TENCENT_COS_BUCKET=context-os-documents
TENCENT_COS_REGION=ap-guangzhou

# Qdrant
QDRANT_URL=http://qdrant-server-ip:6333

# OneAPI
ONEAPI_BASE_URL=http://your-oneapi
ONEAPI_KEY=sk-xxx

# 回调地址
CALLBACK_BASE_URL=https://your-domain.com

# Embedding
EMBEDDING_MODEL=BAAI/bge-m3
```

---

## 7. 迁移任务清单

- [ ] 购买腾讯云轻量服务器 A (2C2G, Node.js)
- [ ] 购买腾讯云轻量服务器 B (2C2G, Qdrant 预装)
- [ ] 开通腾讯云 COS 对象存储
- [ ] 开通腾讯云 TDMQ 消息队列
- [ ] 开通腾讯云 SCF 函数计算
- [ ] 配置域名和 SSL 证书
- [ ] 部署前端到轻量服务器 A
- [ ] 部署 SCF 函数代码
- [ ] 配置 TDMQ 触发器
- [ ] 测试端到端流程

---

## 8. 与原架构的主要变化

| 变化 | 原方案 (v1) | 新方案 (v2) |
|-----|------------|------------|
| 云厂商 | 混合 (阿里云 + Supabase) | 腾讯云全家桶 |
| 前端部署 | Coolify / 阿里云 ECS | 腾讯云轻量服务器 |
| 认证 | Supabase Auth | 自建 JWT + SQLite |
| 元数据库 | Supabase PostgreSQL | SQLite |
| 向量库 | Supabase (pgvector) | Qdrant (独立服务器) |
| 文件存储 | Supabase Storage | 腾讯云 COS |
| 消息队列 | BullMQ + Redis | 腾讯云 TDMQ |
| 函数计算 | 阿里云 FC | 腾讯云 SCF |

---

## 9. 成本总结

| 资源 | 规格 | 月成本 |
|-----|------|-------|
| 轻量服务器 A | 2C2G | ¥50 |
| 轻量服务器 B (Qdrant) | 2C2G | ¥70 |
| COS 对象存储 | 50GB | ¥10-20 |
| TDMQ 消息队列 | | ¥20-30 |
| SCF 函数计算 | | ¥50-100 |
| 域名 + SSL | | ¥10-50 |
| **总计** | | **¥210-370/月** |

---

## 附录：快速迁移指南

### A.1 从 Supabase 迁移数据到 SQLite

```bash
# 1. 导出 Supabase 数据
# 2. 转换为 SQLite 格式
# 3. 导入到新数据库
```

### A.2 代码迁移要点

1. **认证代码**：从 `@supabase/auth-helpers-nextjs` 迁移到自建 JWT
2. **数据库查询**：从 Supabase Client 迁移到 better-sqlite3
3. **文件上传**：从 Supabase Storage 迁移到腾讯云 COS
4. **向量搜索**：从 pgvector 迁移到 Qdrant

---

**文档版本**: 2.0
**更新者**: Claude
**审核状态**: 待确认
