<style>
</style>

产品需求文档 (PRD) 框架：Context
OS (DeepK-Hybrid 版)

1. 项目概述 (Project
   Overview)

1.1 产品愿景 (TL;DR)

**Context OS** 是一个企业级知识资产管理与深加工平台，旨在将传统的“文件堆放处”升级为用户“意图的发射台”。本项目采用 **“计算本地化 + 数据云端化”** 的混合架构 (Hybrid
Architecture)，结合 **DeepK** 深度认知流水线，解决传统 RAG（检索增强生成）系统在处理高价值知识时面临的“浅层检索”与“高并发限流”两大痛点。

1.2 核心目标与解决的问题

本产品致力于解决以下核心技术与业务问题：

1. **解决高并发下的系统崩溃**：通过“流量大坝”机制，将用户请求与 GPU 资源解耦，确保在高并发场景下后端不崩盘，实现用户无感排队。

2. **解决模型限流问题 (429
   Errors)**：通过聚合多渠道模型构建“无限 TPM
   (Tokens Per Minute) 池”，彻底解决 DeepSeek 等高性能模型的限流问题。

3. **解决知识加工深度不足**：摒弃简单的切片检索，采用“全量上下文加载”与“代理人反思 (Agentic Refinement)”机制，对文档进行超级扫描与图谱提取，输出高价值洞察。

1.3 产品形态与体验

• **前端形态**：采用类似 IDE 的“三栏式布局” (Three-Pane
Layout)，利用雅各布定律降低用户的学习成本。

    ◦ **左侧**：资源容器与意图管理。

    ◦ **中间**：流动对话 (Chat Flow)，支持隐性情绪分析与显性笔记保存。

    ◦ **右侧**：沉淀编辑器，支持 AI 生成内容的卡片化插入与重构。

• **交互体验**：引入“进度条心理学”，通过 WebSocket/SSE 实时推送认知扫描的细粒度状态（如“识别为概念知识”、“发现5个关键点”），缓解用户在深度加工过程中的等待焦虑。

1.4 核心技术策略

为了实现 MVP (Minimum Viable Product) 的快速交付与高性能：

• **混合架构**：计算层（Next.js

+ OneAPI）部署在阿里云 ECS，数据层（数据库、Auth、向量检索、存储）全面托管给 **Supabase**，以此解决本地存储易丢失及配置复杂的痛点。

• **模型路由**：后端 Worker 节点通过统一的 **OneAPI** 网关接入，屏蔽底层模型厂商的差异与故障转移逻辑。

• **异步处理**：利用 Redis 和 Celery 构建任务队列，实现文件的异步投递与处理。

1.5 成功标准 (Success
Metrics)

• **用户体验**：文件上传接口响应时间 < 200ms (由异步投递保证)。

• **知识质量**：针对高价值文档（>7分），系统能自动触发反思循环，输出结构化的 JSON 资产包而非简单摘要。

• **系统稳定性**：在模型供应商限流的情况下，通过多渠道轮询保证服务不中断。

2. 技术架构与约束 (Technical Architecture & Constraints)

**给 AI 的指令**：本部分是系统的“骨架”与“神经”。请严格遵循**混合架构 (Hybrid Architecture)** 模式：计算资源在本地/云服务器，数据与鉴权托管于 Supabase。所有 AI 调用必须经过 OneAPI 网关。

2.1 基础设施与部署架构 (Infrastructure & Deployment)

本项目采用 **“计算本地化 + 数据云端化”** 的混合策略，以平衡性能、成本与开发效率。

• **计算层 (Compute
Layer - Self-Hosted)**:

    ◦ **应用服务**: 部署于阿里云 ECS（香港/新加坡节点以优化 Supabase 连接），通过 **Coolify** 管理容器。

    ◦ **AI** **网关**: **OneAPI** (Docker 部署)，作为唯一的 LLM 出口，屏蔽底层模型商差异。

    ◦ **异步队列**: **Redis** (Coolify 托管)，用于实现“流量大坝”机制，拦截高并发请求。

• **数据层 (Data
Layer - Managed by Supabase)**:

    ◦ **核心数据库**: Supabase (PostgreSQL)。

    ◦ **身份认证**: Supabase Auth。

    ◦ **非结构化存储**: Supabase Storage (用于存 PDF 原文)。

    ◦ **向量检索**: Supabase Vector (pgvector)。

2.2 技术栈选型 (Technology Stack)

• **全栈框架**: **Next.js
14+ (App Router)** + TypeScript。选用此框架以利用 Server
Actions 进行后端逻辑处理。

• **数据库交互**:

    ◦ **SDK**: supabase-js (主要用于客户端及简单服务端操作)。

    ◦ **ORM**: Prisma 或 Drizzle (可选，用于服务端复杂查询与事务管理)。

• **AI** **编排与逻辑**:

    ◦ **LangChain.js / LangGraph.js**: 用于复刻 DeepK 的认知流水线逻辑。

    ◦ **OneAPI**: 聚合 DeepSeek-V3 (硅基流动、阿里云百炼、火山引擎) 等渠道，构建“无限 TPM 池”,。

• **任务队列**: **BullMQ** (基于 Redis)，用于承载“认知扫描”等长耗时任务。

• **实时通信**: **Server-Sent
Events (SSE)** 或 WebSocket，用于向前端推送“进度条心理学”所需的实时日志。

2.3 核心数据策略 (Data
& Storage Strategy)

*此部分为不可变约束，AI Coding 时需严格遵守。*

1. **文件“旁路”上传策略**:

    ◦ **前端直传**: 文件流**不经过** Next.js 应用服务器。前端直接使用 Supabase Client 上传至 documents 存储桶。

    ◦ **后端仅收路径**: Next.js 后端 API 仅接收文件的 storage_path 或 file_id，然后触发异步解析任务。

    ◦ **目的**: 极大节省应用服务器的带宽与内存，防止大文件上传阻塞主线程。

2. **向量存储规范**:

    ◦ 在 Supabase SQL Editor 中执行 create extension vector; 开启支持。

    ◦ 向量维度需与 Embedding 模型（如 text-embedding-3-small 或 bge-m3）保持一致。

3. **数据库连接策略**:

    ◦ 生产环境（Coolify）必须使用 **Transaction Mode (端口 6543)** 连接 Supabase，以复用连接池，防止 Serverless 函数耗尽数据库连接,。

2.4 深度认知流水线架构 (The
DeepK Pipeline)

*基于 DeepK-SaaS 方案，将业务逻辑解耦为异步流。*

2.4.1 流量大坝 (The
Dam)

• **入水口**: 用户上传文件后，后端不立即解析。

• **蓄水池**: 将任务推入 Redis 队列 task_queue:pending，并立即返回前端“排队中”状态，确保接口响应 <
200ms。

• **调度器**:
Worker 根据当前全局 TPM 水位（global_tpm_usage）从队列获取任务，实现削峰填谷。

2.4.2 认知引擎 (Cognitive Engine)

Worker 获取任务后，执行以下逻辑（需并在代码中复现 Dify DSL 逻辑）：

1. **Full Context Loading (****全量加载)**: 从 Supabase
   Storage 下载文件，不做切片，直接读取全文（利用 DeepSeek 长窗口）。

2. **Super Scan (****超级扫描 - 逻辑流)**: 调用 OneAPI，发送 Prompt："阅读全文，判断知识价值（评分），输出核心洞察 JSON"。

3. **Graph Extractor (****图谱提取 - 结构流)**: 并行调用，提取实体关系（Node/Edge）。

4. **Agentic Refinement (****反思优化)**: 若评分 > 7，触发“找茬”机制，将初稿发回模型进行 Critique 和 Polish。

2.5 关键系统约束 (Constraints)

1. **禁止直连**: 代码中严禁出现 https://api.openai.com 或 https://api.deepseek.com。所有 LLM 请求必须指向环境变量 ONEAPI_BASE_URL,。

2. **身份源唯一**: 严禁自建 User 表存储密码。必须使用 Supabase Auth 的 users 表作为身份唯一信源，业务表通过 user_id (UUID) 进行外键关联。

3. **开发环境隔离**:

    ◦ 本地开发环境 (.env.local) 连接 Supabase 的 Session Mode (5432)。

    ◦ OneAPI 本地地址通常为 http://localhost:3000/v1。

2.6 安全与权限 (Security)

• **RLS (Row Level Security)**: 必须在 Supabase 数据库层面启用 RLS，确保用户只能查询 user_id == auth.uid() 的数据和文件。

• **Service Role Key**: 仅在后端 Worker 写入向量或执行系统级任务时使用，严禁暴露给前端。

3. 用户体验设计 (UX/UI
   Design)

**给 AI 的指令**：本部分定义了前端的“灵魂”。请参照 **Cursor/VS
Code** 等 IDE 的布局逻辑构建界面，利用 **雅各布定律 (Jakob's Law)** 降低用户的学习成本。核心设计哲学是将界面从“文件堆放处”转变为“意图发射台”。

3.1 全局导航与驾驶舱 (Global Navigation & Cockpit)

*系统的一级入口，承载跨库能力与资产概览。*

3.1.1 全局侧边栏 (Global
Sidebar)

位于界面最左侧，作为系统级锚点。

• **核心动作区 (Primary
Actions)**:

    ◦ **🌐 全局探索 (Global Chat)**: 点击进入独立聊天界面。后台调用全局 RAG 检索所有知识库，支持跨库“寻源建议”。

    ◦ **📝 快速笔记 (Quick Note)**: 点击弹出模态框 (Modal)，用于捕捉稍纵即逝的灵感。内容自动存入默认的“收集箱 (Inbox)”。

• **资产导航**:

    ◦ 包含 **全部知识库**、**最近访问 (Recent)** 和 **收藏 (Favorites)**，方便用户快速回到工作流。

3.1.2 知识库概览 (Knowledge Grid)

右侧主体区域，采用 **资源管理器** 布局，强调“资产感”。

• **卡片设计 (Knowledge Card)**:

    ◦ **视觉层级**: 顶部展示由系统根据“意图”自动生成的 Emoji/图标，中间为大号加粗标题（意图），底部为元数据（文件数、最后编辑时间）。

    ◦ **交互**: 点击卡片任意区域，跳转至 **“知识构建工作台”**。

• **工具栏**: 提供视图切换（大卡片/列表）与排序功能（按编辑时间/创建时间）。

3.2 知识构建工作台 (The
Knowledge Workbench)

*核心工作界面，采用**三栏式布局 (Three-Pane Layout)**，对应知识生产的“输入-处理-输出”闭环。*

3.2.1 左侧：容器与资源 (Context & Resources)

• **定位**: 管理“输入材料”，通过勾选框锁定 RAG 上下文范围。

• **功能要求**:

    ◦ **文件资源列表**: 每个文件前必须有 **勾选框 (Checkboxes)**。**逻辑约束**：中间 Chat 的生成仅基于被勾选的文件。

    ◦ **我的笔记区**: 独立分区显示用户保存的笔记 (User Notes)，与 PDF 文件隔离。

    ◦ **上传交互**: 支持拖拽上传。由于后端采用异步队列（流量大坝），前端上传后需立即显示“排队中”状态，不阻塞界面。

3.2.2 中间：流动对话 (Chat
Flow)

• **定位**: AI 处理信息与交互的区域。

• **进度条心理学 (Progress Psychology)**:

    ◦ 由于后端执行“深度认知扫描”耗时较长，前端必须通过 **WebSocket/SSE** 接收并展示细粒度日志。

    ◦ **状态文案示例**: “正在全量加载上下文...”、“识别为[概念类]知识...”、“已提取实体关系图谱...”、 “正在反思优化初稿...”[DeepK架构]。

• **显性操作**:

    ◦ AI 回答下方悬浮工具栏，必须包含 **[保存到笔记 (Save to Note)]** 按钮。

    ◦ **交互动效**: 点击“保存”时，文本产生“飞入”右侧编辑器的动效，提供明确的系统反馈。

3.2.3 右侧：沉淀编辑器 (The
Editor)

• **定位**: 用户的主动工作区，用于知识重构与输出。

• **卡片化插入 (Card
Insertion)**:

    ◦ 来自中间对话的“保存”内容，不应作为纯文本追加，而应以 **可编辑的“卡片”或“块” (Block)** 形式插入光标处。

    ◦ 卡片头部自动生成小标题，正文支持 Markdown 编辑。

• **Slash Command (/)**:

    ◦ 集成快捷生成工具，输入 / 唤起菜单：/生成QA、/提取金句、/扩展文章等。

    ◦ **逻辑约束**: 这些命令的 Prompt 必须动态引用左侧**已勾选**的文件作为 Context。

3.3 视觉与反馈规范 (Visual
& Feedback)

• **暗色模式 (Dark
Mode)**: 默认采用深色 IDE 风格（参考 VS Code 或 Linear），营造沉浸式心流体验。

• **引用机制**: 全局 Chat 模式下，AI 回答必须包含来源角标（如 [知识库A - 文件1]），点击可跳转至对应文件。

• **状态同步**: 利用 Supabase 的 Realtime 功能，确保左侧笔记列表与右侧编辑器内容的实时同步。

4. 核心功能需求 (Functional Requirements)

**给 AI 的指令**：本章节将业务逻辑拆解为具体的“输入-处理-输出”流程。请注意，所有的后端数据操作必须通过 **Supabase Client** 进行，所有的 AI 推理必须经过 **OneAPI** 网关。

4.1 身份认证与权限 (Authentication & Security)

*基于 Supabase Auth 的 MVP 方案，摒弃传统自建 User 表模式。*

• **FR-1.1** **登录/注册**:

    ◦ **机制**: 使用 @supabase/auth-helpers-nextjs 实现服务端组件的会话管理。

    ◦ **方式**: 优先支持 **Email
Magic Link** (无密码登录) 和 **GitHub/Google OAuth**。

    ◦ **逻辑**: 登录成功后，自动在 public.users 表中同步用户的基础信息（利用 Supabase 的 Trigger 触发器自动同步 auth.users 数据）。

• **FR-1.2** **数据安全 (RLS)**:

    ◦ **约束**: 必须在 PostgreSQL 层面启用 **Row Level Security (RLS)**。

    ◦ **策略**: 任何 SELECT/INSERT/UPDATE/DELETE 操作，必须校验 auth.uid() ==
user_id，确保用户只能访问自己的知识库。

4.2 知识摄入与流量大坝 (Ingestion & The Dam)

*解决高并发导致服务器崩溃的核心机制，实现“用户无感排队”。*

• **FR-2.1** **文件旁路上传 (Bypass Upload)**:

    ◦ **前端动作**: 用户拖拽 PDF，前端直接调用 Supabase Client 将文件上传至 documents 存储桶（Bucket），不经过 Next.js 后端服务器，节省带宽。

    ◦ **后端触发**: 上传成功后，前端仅将 storage_path 发送给后端 API /api/ingest。

• **FR-2.2** **流量大坝 (The Dam)**:

    ◦ **入队逻辑**: 后端接收请求，不立即解析，而是生成一个 task_id，将任务推入 **Redis 队列** (task_queue:pending)。

    ◦ **即时反馈**: 接口在 200ms 内返回 HTTP 202 (Accepted)，前端状态变更为“排队中...”。

• **FR-2.3** **异步调度器**:

    ◦ **Worker**: 后台 Worker (Celery/BullMQ) 监控 Redis 队列。

    ◦ **限流检查**: 取任务前检查 global_tpm_usage (全局 TPM 水位)，若 OneAPI 负载过高，自动延迟执行。

4.3 深度认知流水线 (Cognitive Pipeline)

*复刻 DeepK 逻辑，将非结构化文档转化为结构化资产。*

• **FR-3.1** **全量上下文加载**:

    ◦ Worker 从 Supabase Storage 下载文件，利用 DeepSeek-V3 的长窗口能力，**不做切片**，直接加载全文进内存。

• **FR-3.2** **并行认知扫描 (Parallel Processing)**:

    ◦ **任务 A (Super Scan)**: 调用 OneAPI，执行 Prompt：“阅读全文，判断知识价值评分（0-10）。如果是高价值（>7分），输出核心洞察 JSON”。

    ◦ **任务 B (Graph Extractor)**: 提取实体关系（Node/Edge），生成知识图谱数据结构。

• **FR-3.3** **结果沉淀**:

    ◦ 将生成的 meta_summary (JSON) 和 knowledge_graph 存入 Supabase 的 documents 表。

    ◦ 将向量化数据存入 document_chunks 表（通过 pgvector）。

4.4 交互式知识构建 (Interactive Construction)

*对应前端“三栏布局”的实时交互逻辑。*

• **FR-4.1** **进度条心理学 (Progress Streaming)**:

    ◦ **机制**: 后端处理流水线时，通过 **Server-Sent Events (SSE)** 或 WebSocket 向前端推送实时状态。

    ◦ **显示内容**: “正在全量加载...”、“识别为[方法论]知识...”、“已提取 20 个关键实体...”。

• **FR-4.2** **上下文感知的 Chat (Context-Aware Chat)**:

    ◦ **触发**: 用户在左侧 Sidebar 勾选特定文件（Checkbox）。

    ◦ **检索**: 后端仅在**被勾选文件**的 doc_id 范围内进行混合检索（Keyword + Vector Search）。

    ◦ **生成**: LLM 基于检索内容回答，并必须在句末标注引用来源 [File Name]。

• **FR-4.3** **显性知识沉淀 (Save to Note)**:

    ◦ **动作**: 用户点击 Chat 回答下方的“保存到笔记”按钮。

    ◦ **逻辑**: 前端不只是复制文本，而是请求后端将该段内容转化为一个 **Block (卡片)**，插入到右侧编辑器的光标位置。

    ◦ **数据**: 同步在 Supabase 的 notes 表中创建一条记录。

4.5 意图与资源管理 (Intent
& Resource Mgmt)

• **FR-5.1** **意图容器 (Knowledge Base)**:

    ◦ 支持创建“知识库”（即意图容器）。每个知识库对应 Supabase 中的 knowledge_bases 表的一行。

    ◦ 支持自定义图标（Emoji），系统根据标题自动生成 Emoji 推荐。

• **FR-5.2** **斜杠命令 (Slash Commands)**:

    ◦ 在右侧编辑器输入 / 唤起菜单。

    ◦ **逻辑**: 命令（如 /生成QA）会自动抓取左侧**已勾选**的文件作为 Context，调用 OneAPI 生成内容并填入编辑器。

4.6 错误处理与韧性 (Error
Handling)

• **FR-6.1** **模型故障转移**:

    ◦ 若 OneAPI 返回错误（如某个渠道挂了），后端不应报错给用户，应自动重试（OneAPI 内部处理 Failover）。

• **FR-6.2** **任务超时**:

    ◦ 若解析任务超过 5 分钟未完成，Redis 队列将其标记为 failed，前端显示“解析超时，请重试”，并不再阻塞 UI。

5. 数据模型 (Data
   Schema)

**给 AI 的指令**：这是系统的核心数据库设计。请使用 Supabase (PostgreSQL) 的语法。

1. **扩展启用**：必须首先开启 vector 扩展以支持 Embedding。

2. **JSONB** **策略**：利用 PostgreSQL 强大的 JSONB 能力存储 **DeepK** 认知引擎生成的结构化数据（图谱、摘要）。

3. **RLS (****行级安全)**：所有表必须启用 RLS，强制执行 auth.uid() = user_id 的隔离策略。

5.1 数据库扩展与设置 (Extensions)

在 Supabase SQL Editor 中执行的初始化指令：

-- 开启向量检索支持

create extension if not exists vector;

-- 开启 UUID 生成支持

create extension if not exists
"uuid-ossp";

5.2 核心表结构 (Core
Tables)

1. profiles (用户档案表)

*虽然使用 Supabase Auth 管理登录，但需在 public 模式下同步用户信息以建立外键关联。*

• id: UUID, Primary Key, References
auth.users.id (级联删除)。

• email: Text, 冗余字段用于前端显示。

• full_name: Text, 用户昵称。

• avatar_url: Text, 头像链接。

• usage_tpm: BigInt, 记录当前用户消耗的 Token 总量 (用于限流统计)。

• created_at: Timestamptz.

2. knowledge_bases (知识库/意图容器)

*对应前端左侧侧边栏的“意图”容器,。*

• id: UUID, Primary Key (Default:
uuid_generate_v4()).

• user_id: UUID, FK to profiles.id.

• title: Text, 知识库名称（即“意图”，如“SaaS定价策略”）。

• icon: Text, 自动生成的 Emoji 图标。

• description: Text, 意图描述。

• created_at: Timestamptz.

3. documents (文件资源表)

*存储文件的元数据及 **DeepK** 认知流水线的产物。*

• id: UUID, Primary Key.

• kb_id: UUID, FK to knowledge_bases.id.

• user_id: UUID, FK to profiles.id (用于 RLS 快速校验)。

• file_name: Text, 原始文件名。

• storage_path: Text, Supabase Storage 中的存储路径 (例如 uid/kb_id/file.pdf)。

• mime_type: Text, 文件类型 (application/pdf 等).

• file_size: BigInt, 字节数。

• status: Text, 枚举值:
uploading, queued, processing, completed, failed (用于前端进度条展示)。

• error_message: Text, 解析失败时的错误日志。

• **DeepK** **核心字段**:

    ◦ deep_summary: JSONB, 存储 **Task A** 输出的核心洞察、K-Type 评分。

    ◦ knowledge_graph: JSONB, 存储 **Task B** 输出的实体关系图谱 (Nodes/Edges)。

• created_at: Timestamptz.

4. document_chunks (向量切片表)

*用于 RAG 检索的切片数据。*

• id: BigInt, Primary Key (Identity).

• doc_id: UUID, FK to documents.id (级联删除)。

• content: Text, 切片文本内容。

• metadata: JSONB, 包含页码、块索引等信息。

• embedding: vector(1536), 向量数据 (维度需适配 text-embedding-3-small 或同类模型)。

5. chat_sessions (对话会话)

• id: UUID, Primary Key.

• kb_id: UUID, FK to knowledge_bases.id (对话属于某个特定的知识库上下文)。

• user_id: UUID, FK.

• title: Text, 会话标题 (自动生成).

• created_at: Timestamptz.

6. chat_messages (消息记录)

• id: BigInt, Primary Key.

• session_id: UUID, FK to chat_sessions.id.

• role: Text, 枚举:
user, assistant.

• content: Text, 消息内容。

• citations: JSONB, 引用来源数组 (例如 [{"doc_id": "...",
"page": 1}])，用于前端显示角标。

• created_at: Timestamptz.

7. notes (用户笔记/卡片)

*对应右侧“沉淀编辑器”的数据。*

• id: UUID, Primary Key.

• kb_id: UUID, FK to knowledge_bases.id.

• user_id: UUID, FK.

• content: Text, Markdown 格式的笔记内容。

• is_shared: Boolean, 分享开关 (V1.1 新增需求)。

• share_token: UUID, 用于生成公开只读链接 (V1.1 新增需求)。

• updated_at: Timestamptz.

5.3 安全策略 (Security
Policies - RLS)

**重要**：Supabase 中必须对以上所有表启用 RLS (Enable Row Level Security)。

**通用策略模版 (以 documents 表为例)**：

-- 允许用户查看自己的文档

create policy "Users can view own
documents"

on documents for select

using ( auth.uid() = user_id );

-- 允许用户上传自己的文档

create policy "Users can insert own
documents"

on documents for insert

with check ( auth.uid() = user_id );

-- 允许用户更新自己的文档 (例如更新状态)

create policy "Users can update own
documents"

on documents for update

using ( auth.uid() = user_id );

**例外情况**：

• **V1.1** **分享功能**：针对 notes 表，需添加一条允许匿名读取的策略，条件是 is_shared = true
AND share_token = current_token。

5.4 实时订阅 (Realtime)

*为了实现“进度条心理学” 和“聊天流式输出”，需在 Supabase
Dashboard 中对以下表开启 **Realtime** 功能：*

1. documents: 用于前端监听 status 字段的变化（如从 processing 变为 completed）。

2. chat_messages: 用于多端同步聊天记录。

5.5 存储桶策略 (Storage
Policies)

• **Bucket Name**: documents

• **Access**: Private (私有)。

• **Policy**: 仅允许 auth.uid() 等于路径中 user_id 前缀的用户进行 Upload/Select/Delete 操作。

6. 不做什么 (Out of
   Scope)

**给 AI 的指令**：本章节定义了项目的**负面约束 (Negative Constraints)**。在生成代码或规划任务时，若遇到以下功能请求，请直接忽略或标记为 Post-MVP。请严格遵守“简单即是美”的原则，不要进行过度设计。

6.1 协作与多租户限制 (Collaboration & Multi-tenancy)

• **❌ 不做实时协同编辑 (No Real-time Co-editing)**：

    ◦ 虽然 V1.1 引入了“分享”功能，但仅限于只读或Fork（复制）。系统**不支持**类似 Google Docs 或 Notion 的多人同时在线编辑同一个文档或笔记的功能。

    ◦ **原因**: 实时协同需要复杂的 CRDT (Conflict-free Replicated Data Types) 算法和 WebSocket 状态同步，技术成本过高，不符合 MVP 快速验证的目标。

• **❌ 不做复杂的组织架构管理 (No Enterprise RBAC)**：

    ◦ 不支持“团队/部门”概念，不支持多层级的权限继承（如：组长能看组员的笔记）。

    ◦ **约束**: 权限模型扁平化，仅区分 Owner (拥有者) 和 Viewer (V1.1 分享后的查看者)。所有数据隔离基于 user_id 进行。

6.2 终端与交互限制 (Platform & Devices)

• **❌ 不开发原生移动端 App (No Native Mobile Apps)**：

    ◦ **不做** iOS (Swift) 或 Android (Kotlin) 原生应用。

    ◦ **替代方案**: 仅保证移动端浏览器的 H5 适配（响应式布局），但核心的“三栏式”知识加工体验主要针对 **Desktop (桌面端)** 宽屏场景优化。

• **❌ 不做复杂的文件预览 (No Complex File Preview)**：

    ◦ **不做** Office 文档（Word/Excel/PPT）的在线渲染和转换。

    ◦ **约束**: 系统仅支持 **PDF** 和 **Markdown/Text** 的深度解析与预览。对于其他格式，建议用户先转换为 PDF 上传。

6.3 基础设施与运维限制 (Infrastructure & DevOps)

• **❌ 严禁自建基础服务 (No Self-Hosting Complex Services)**：

    ◦ **拒绝 MinIO**: 文件存储必须使用 **Supabase Storage**，严禁在阿里云 ECS 上自建 MinIO 或挂载本地磁盘存储文件。

    ◦ **拒绝 ClickHouse/ES**: 所有的向量检索和结构化查询必须基于 **Supabase (PostgreSQL

+ pgvector)**，不引入额外的重型检索引擎。

    ◦ **拒绝自建 Auth**: 严禁编写 JWT 签发、密码加密存储等逻辑，必须完全依赖 **Supabase Auth**。

• **❌ 不做 OCR (光学字符识别)**：

    ◦ MVP 阶段仅处理“数字原生”的 PDF（可选中文本）。对于扫描版 PDF（图片型），后端不集成 Tesseract 或 PaddleOCR，以免撑爆服务器 CPU/内存。

6.4 业务功能边界 (Feature
Boundaries)

• **❌ 不做计费与支付系统 (No Billing Integration)**：

    ◦ MVP 阶段**不集成** Stripe 或微信支付。

    ◦ **替代**: 通过后端数据库手动设置 usage_tpm 限额或白名单机制来控制成本。

• **❌ 不做全网搜索 (No Web Search)**：

    ◦ 尽管 UX 文档提到了“联网搜索”，但在 MVP 的技术架构中（OneAPI

+ DeepSeek），**暂不**集成 Serper/Bing API 进行实时联网增强。RAG 仅基于用户上传的私有知识库。

--------------------------------------------------------------------------------

给 AI Coding 的最终检查清单 (Final Checklist for AI)

在开始写代码前，请确认：

1. 是否使用了 Supabase
   Auth 而非自建 User 表？

2. 文件上传是否绕过了 Next.js 服务器直接去了 Supabase Storage？

3. LLM 调用是否全部指向了 OneAPI？

4. 是否避免了所有实时协作代码的编写？

PRD 增量更新：v1.1 分享与协作模块 (Share & Collaborate)

1. 需求变更说明 (Change
   Log)

• **新增能力**: 允许用户生成笔记的分享链接。

• **核心约束**: 接收者 **只能** 针对笔记内容进行对话，**严禁** 访问或索引原拥有者的源文件（PDF/Docs）。

• **数据流向**: 笔记内容 (Note Content) -> 共享视图 -> 接收者 RAG -> 接收者新笔记。

2. 用户体验更新 (UX
   Updates)

2.1 分享者视角 (Sharer)

• **入口**: 在右侧“沉淀编辑器”顶部增加 **[分享 (Share)]** 按钮。

• **交互**:

    ◦ 点击后弹窗生成一个 **“公共只读链接”** (例如:
.../share/note_uuid)。

    ◦ 开关选项：[x] 允许对方通过 AI 对话 (Allow AI Chat)。

2.2 接收者视角 (Receiver)

• **界面**: 打开链接后，进入一个 **“双栏布局”** (原三栏的简化版)。

    ◦ **左侧**: 笔记阅读区 (只读 Markdown)。**不显示** 原作者的“文件资源列表”（保护源文件隐私）。

    ◦ **右侧**: 协作对话区 (Chat Flow)。

• **交互**:

    ◦ **Chat**: 接收者可以针对左侧笔记内容提问（如“帮我总结这段笔记的三个重点”）。

    ◦ **Fork (****保存副本)**: 对话区 AI 的回答下方，或笔记顶部，需提供 **[保存到我的笔记 (Save to My Notes)]** 按钮。

    ◦ *逻辑*: 点击保存后，内容被复制到接收者自己的 notes 表中，完全脱离原分享关系。

3. 功能需求与逻辑 (Functional Requirements)

3.1 核心逻辑：沙箱隔离 (Sandbox Isolation)

• **FR-Share-01 (****上下文限制)**:

    ◦ 当接收者在分享页面发起 Chat 时，后端构建的 Prompt Context **只能包含该条笔记的文本内容**。

    ◦ **严禁** 触发针对原 documents 表的向量检索。**这是安全红线**。

• **FR-Share-02 (****数据克隆)**:

    ◦ 当接收者点击“保存到我的笔记”时，执行 INSERT INTO notes (user_id, content...)，将 user_id 设为当前登录者 (接收者) 的 ID。

3.2 数据库变更 (Schema
Changes)

*需更新 Supabase 模型设计*

1. **修改 notes 表**:

    ◦ 新增字段 is_shared (Boolean, default false).

    ◦ 新增字段 share_token (UUID, nullable, 用于生成不暴露主键的链接).

2. **RLS (****行级安全) 策略更新**:

    ◦ **原策略**: SELECT 仅限 auth.uid() == user_id.

    ◦ **新策略 (OR逻辑)**: 允许 SELECT 如果 auth.uid() == user_id **OR** (is_shared == true AND share_token ==
input_token).

4. 给 AI Coding 的补充指令 (Implementation Prompts)

如果你正在使用 Cursor/Windsurf，请投喂以下指令以更新代码：

"我们需要在现有 Context OS 基础上增加‘笔记分享’功能。请执行以下变更：

1. **数据库层**: 修改 Supabase 的 notes 表，增加分享状态字段。请编写 SQL 更新 RLS 策略，允许通过 share_token 进行匿名或跨用户读取，但严禁读取关联的 documents 表。

2. **前端路由**: 新增 /share/[token] 页面。该页面为双栏布局，左侧渲染 Markdown 笔记，右侧是 Chat 组件。

3. **RAG** **逻辑**: 在 /api/chat/share 接口中，**切断**与 Vector Store 的连接。Context 仅来源于是当前笔记的纯文本内容。

4. **UI**: 在分享页增加‘保存到我的库’按钮，调用 Server
   Action 将内容复制到当前用户的笔记表中。"
