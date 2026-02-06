# Context-OS 快速参考卡片

> **一页纸掌握整个项目** 📋

---

## 🎯 项目定位

**Context-OS** = 企业级智能知识管理系统 (基于 RAG)

**核心功能**: 文档管理 + 语义检索 + AI 对话 + K-Type 认知分析

**当前版本**: Unreleased (开发版) | **生产就绪度**: 95%

---

## 🏗️ 技术栈速览

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16 + React 19 + TypeScript + Tailwind CSS + Zustand |
| **后端** | Next.js API Routes + SQLite + BullMQ + Redis |
| **AI** | LiteLLM + Qdrant + DeepSeek/Qwen |
| **部署** | Docker Compose + PM2 + Nginx |

---

## 🚀 快速启动 (3 步)

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
docker-compose up -d  # Qdrant + Redis + LiteLLM
npm run dev           # Next.js

# 3. 访问应用
# http://localhost:3000
```

---

## 🔑 必需的 API Keys

| 服务 | 用途 | 注册地址 |
|------|------|----------|
| **SiliconFlow** | Embedding 模型 | https://cloud.siliconflow.cn/ |
| **Dashscope** | Chat/K-Type 模型 | https://dashscope.aliyun.com/ |
| **DeepSeek** | Chat 模型 (可选) | https://platform.deepseek.com/ |

配置位置: `.env` 文件

---

## 📁 核心目录结构

```
context-os/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   └── (pages)/           # 页面组件
├── lib/                   # 核心业务逻辑
│   ├── auth/             # 认证模块
│   ├── processors/       # 文档处理
│   ├── rag/              # RAG 检索
│   ├── stores/           # Zustand 状态
│   └── db/               # 数据库
├── components/           # React 组件
├── docs/                 # 项目文档
└── scripts/              # 工具脚本
```

---

## 🔄 核心流程

### 文档上传流程
```
上传 → 验证 → 队列 → Worker → K-Type → 分块 → 向量化 → Qdrant
```

### RAG 问答流程
```
提问 → 文档层检索 → 父块层检索 → 子块层检索 → LLM → 流式响应
```

---

## 🛠️ 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器

# Worker
npm run worker           # 启动文档处理 Worker

# 测试
npm run test             # 运行测试
npm run test:perf        # 性能测试

# 代码检查
npm run lint             # ESLint 检查
npm run typecheck        # TypeScript 类型检查

# Docker
docker-compose up -d     # 启动所有服务
docker-compose down      # 停止所有服务
docker-compose logs -f   # 查看日志
```

---

## 📊 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 3000 | Next.js 前端 |
| Backend API | 3002 | API 服务 (Docker) |
| LiteLLM | 4000/4410 | LLM 网关 |
| Qdrant | 6333 | 向量数据库 |
| Redis | 6379 | 任务队列 |

---

## 🔧 关键配置文件

| 文件 | 用途 |
|------|------|
| `.env` | 环境变量 (API Keys) |
| `litellm-config.yaml` | LLM 模型配置 |
| `docker-compose.yml` | Docker 服务编排 |
| `package.json` | 项目依赖和脚本 |
| `next.config.ts` | Next.js 配置 |

---

## 📚 核心文档索引

| 文档 | 说明 |
|------|------|
| `README.md` | 项目简介 |
| `docs/ARCHITECTURE.md` | 架构说明 |
| `docs/CODEMAP.md` | 代码地图 |
| `docs/DEVELOPMENT.md` | 开发指南 |
| `docs/PROJECT_UNDERSTANDING_SUMMARY.md` | 项目全面理解 |
| `docs/rag-three-layer-retrieval.md` | RAG 检索策略 |
| `docs/FRONTEND_TECH_STACK.md` | 前端技术规范 |

---

## 🐛 常见问题

**Q: 文档处理失败？**
- 检查 Worker 是否启动: `npm run worker`
- 查看 Redis 连接: `docker ps | grep redis`

**Q: LiteLLM 模型不健康？**
- 检查 API Keys 是否配置正确
- 重启服务: `docker-compose restart litellm`

**Q: Qdrant 连接失败？**
- 检查服务状态: `curl http://localhost:6333`
- 查看日志: `docker logs qdrant`

---

## ✅ 项目状态检查清单

- [ ] 所有服务启动 (`docker-compose ps`)
- [ ] API Keys 已配置 (`.env`)
- [ ] LiteLLM 健康 (`curl http://localhost:4000/health`)
- [ ] Qdrant 可访问 (`curl http://localhost:6333`)
- [ ] 前端可访问 (`http://localhost:3000`)

---

## 🎯 下一步行动

### 今天 (1 小时)
1. 配置 API Keys
2. 启动所有服务
3. 测试文档上传

### 本周
1. 运行完整测试
2. 性能基准测试
3. 部署到测试环境

### 本月
1. 生产环境部署
2. 用户培训
3. 监控和优化

---

**快速帮助**: 查看 `docs/PROJECT_UNDERSTANDING_SUMMARY.md` 获取完整项目理解

**最后更新**: 2025-01-XX

