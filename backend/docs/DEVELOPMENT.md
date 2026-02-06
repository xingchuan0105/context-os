# Context-OS 开发指南

## 环境要求

- Node.js 18+
- Docker (用于 Qdrant、LiteLLM、Redis)
- Python 3.8+ (用于 semchunk 分块)

## 安装

```bash
# 克隆项目
git clone <repo-url>
cd context-os

# 安装依赖
npm install
```

---

## 启动服务

### 方式一: Docker Compose (推荐)

使用 `docker-compose.dev.yml` 一键启动所有服务：

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**服务端口映射：**

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|----------|----------|------|
| backend | 3000 | 3002 | 后端 API |
| frontend | 3000 | 3003 | 前端应用 |
| litellm | 4000 | 4410 | LLM 代理 |
| qdrant | 6333 | - | 向量数据库 (内部) |
| redis | 6379 | - | 任务队列 (内部) |

**访问地址：**
- 前端: http://localhost:3003
- 后端 API: http://localhost:3002
- LiteLLM: http://localhost:4410

### 方式二: 本地开发

```bash
# 1. 启动基础服务 (Qdrant, Redis, LiteLLM)
docker-compose -f docker-compose.dev.yml up -d qdrant redis litellm

# 2. 启动后端 (端口 3000)
npm run dev

# 3. 启动前端 (另一个终端, 端口 3001)
cd ../frontend
npm run dev
```

---

## 环境变量

复制 `.env.example` 到 `.env` 并配置：

```env
# ========== LLM 服务 ==========
LITELLM_BASE_URL=http://localhost:4000/v1
LITELLM_API_KEY=local-dev
KTYPE_MODEL=qwen-flash
EMBEDDING_MODEL=qwen3-embedding-4b
RERANKER_MODEL=qwen3-reranker-4b

# ========== 数据库 ==========
DATABASE_URL=file:data/context-os.db
QDRANT_URL=http://localhost:6333

# ========== Redis ==========
REDIS_HOST=localhost
REDIS_PORT=6379

# ========== 认证 ==========
JWT_SECRET=your-secret-key-change-in-production
COOKIE_SECURE=false

# ========== 邮件 (SMTP) ==========
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@163.com
SMTP_PASS=your-smtp-password
SMTP_FROM=Context-OS <your-email@163.com>

# ========== 文档处理 ==========
KTYPE_MAX_TOKENS=500000
KTYPE_MAX_CHARS=990000
DOC_CHUNK_SIZE=2400
DOC_CHUNK_OVERLAP=300
PARENT_CHUNK_SIZE=1600
```

---

## 开发规范

### 代码风格
- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 组件使用函数式 + Hooks

### 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
refactor: 重构
test: 测试
chore: 构建/工具变动
security: 安全修复
```

---

## 测试

```bash
npm run test
```

## 构建

```bash
npm run build
```

## 常见问题

### 1. semchunk 分块失败
确保 Python 环境已安装 semchunk：
```bash
pip install semchunk
```

### 2. Qdrant 连接失败
检查 Qdrant 服务是否启动：
```bash
docker ps | grep qdrant
```

### 3. 邮件发送失败
- 检查 SMTP 配置是否正确
- 163 邮箱需要开启 SMTP 服务并使用授权码
