# Context OS v1 → v2 迁移完成指南

## ✅ 已完成的迁移

### Phase 1: 清理v1遗留依赖
- ✅ 移除 `@supabase/ssr`, `@supabase/supabase-js`
- ✅ 移除 `bullmq`, `ioredis`
- ✅ 添加 `kafkajs` (TDMQ客户端)

### Phase 2: 迁移认证系统
- ✅ 创建JWT认证系统 (`lib/auth/jwt.ts`, `lib/auth/password.ts`, `lib/auth/session.ts`)
- ✅ 创建SQLite数据库schema (`lib/db/schema.ts`)
- ✅ 创建认证API (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`)
- ✅ 更新登录页面 (`app/login/page.tsx`)
- ✅ 更新主页面 (`app/page.tsx`)

### Phase 3: 迁移数据库
- ✅ 创建数据访问层 (`lib/db/queries.ts`)
- ✅ 更新知识库API (`/api/knowledge-bases`)
- ✅ 创建文档API (`/api/documents`)

### Phase 4: 迁移文件存储
- ✅ 创建腾讯云COS客户端 (`lib/storage/cos.ts`)
- ✅ 更新文档上传API支持COS

### Phase 5: 迁移向量库
- ✅ Qdrant客户端已完善 (`lib/qdrant.ts`)
- ✅ 更新搜索API (`/api/search`)

### Phase 6: 替换消息队列
- ✅ 创建TDMQ客户端 (`lib/queue/tdmq.ts`)
- ✅ 集成TDMQ到文档上传流程

### Phase 7: 更新文档处理流程
- ✅ 创建SCF回调API (`/api/callback/document`)
- ✅ 创建SCF函数代码 (`functions/document-processor/index.ts`)

---

## 📋 部署前检查清单

### 1. 腾讯云资源购买
- [ ] 轻量应用服务器A (2C2G, Node.js) - ¥50/月
- [ ] 轻量应用服务器B (2C2G, Qdrant预装) - ¥70/月
- [ ] COS对象存储桶 (context-os-documents)
- [ ] TDMQ消息队列 (topic: context-doc-process)
- [ ] SCF函数计算 (Node.js 20)
- [ ] 域名 + SSL证书

### 2. 环境变量配置
复制 `.env.example` 到 `.env` 并填写：

```bash
# 必填项
DATABASE_URL=./data/context-os.db
JWT_SECRET=your-random-secret-key-here

# 腾讯云COS
TENCENT_COS_SECRET_ID=xxx
TENCENT_COS_SECRET_KEY=xxx
TENCENT_COS_BUCKET=context-os-documents
TENCENT_COS_REGION=ap-guangzhou

# Qdrant
QDRANT_URL=http://your-qdrant-server-ip:6333

# OneAPI
ONEAPI_BASE_URL=http://your-oneapi
ONEAPI_KEY=sk-xxx

# TDMQ
TDMQ_BROKER=your-tdmq-broker
TDMQ_USERNAME=your-username
TDMQ_PASSWORD=your-password

# SCF回调
CALLBACK_BASE_URL=https://your-domain.com
```

### 3. 数据库初始化
```bash
mkdir -p data
npm run dev  # 自动创建SQLite数据库
```

### 4. Qdrant初始化
```bash
# 在Qdrant服务器上
curl -X PUT http://localhost:6333/collections/user_test_vectors \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 1024,
      "distance": "Cosine"
    }
  }'
```

### 5. SCF函数部署
1. 打包函数代码：
```bash
cd functions/document-processor
zip -r function.zip ./*
```

2. 在腾讯云SCF控制台：
   - 创建函数 → 上传function.zip
   - 配置环境变量（同.env）
   - 配置TDMQ触发器

---

## 🚀 部署流程

### 前端部署 (轻量服务器A)
```bash
# 1. 安装Node.js 18+
# 2. 克隆代码
git clone <repo> /var/www/context-os
cd /var/www/context-os

# 3. 安装依赖
npm install

# 4. 配置环境变量
cp .env.example .env
nano .env  # 填写配置

# 5. 构建
npm run build

# 6. 启动 (使用PM2)
npm install -g pm2
pm2 start npm --name "context-os" -- start

# 7. 配置Nginx反向代理
# 8. 配置SSL证书
```

### Qdrant部署 (轻量服务器B)
```bash
# 选择预装Qdrant的镜像
# 或手动安装：
docker run -d -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### SCF函数部署
1. 在腾讯云SCF控制台创建函数
2. 上传 `functions/document-processor` 代码
3. 配置环境变量
4. 添加TDMQ触发器

---

## 🧪 测试验证

### 1. 认证测试
```bash
# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 2. 文件上传测试
```bash
# 上传文件
curl -X POST http://localhost:3000/api/documents \
  -F "file=@test.pdf" \
  -F "kb_id=test-kb-id"
```

### 3. 搜索测试
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"测试查询","mode":"drill-down"}'
```

---

## 🔄 数据迁移（可选）

### 从Supabase迁移到SQLite
```bash
# 1. 导出Supabase数据
# 2. 转换为SQLite格式
# 3. 导入到新数据库
```

### 向量数据迁移
```bash
# 从pgvector导出 → 导入到Qdrant
# 需要编写脚本，参考 lib/qdrant.ts
```

---

## ❗ 常见问题

### Q: TDMQ未配置时如何测试？
A: 本地开发可暂时跳过TDMQ，文档不会自动处理，但可以手动调用SCF函数测试。

### Q: SQLite性能如何？
A: 对于中小规模（<10万文档）完全够用，超过后可考虑迁移到PostgreSQL。

### Q: 如何备份SQLite？
A: 
```bash
# 每日自动备份脚本
cp data/context-os.db backup/context-os-$(date +%Y%m%d).db
```

---

## 📞 支持

如有问题请查看：
- PRD文档: `PRD.md`
- 技术文档: `docs/` 目录
- 腾讯云文档: https://cloud.tencent.com/document/product
