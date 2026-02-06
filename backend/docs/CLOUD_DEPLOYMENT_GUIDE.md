# Context-OS 云服务器部署完整指南

## 📋 目录
1. [快速开始](#快速开始)
2. [本地开发配置](#本地开发配置)
3. [云服务器部署](#云服务器部署)
4. [Docker 部署](#docker-部署)
5. [传统部署（PM2）](#传统部署pm2)
6. [故障排查](#故障排查)

---

## 🚀 快速开始

### Step 5: Configure SSL Certificate (Cloudflare Origin)

```bash
sudo mkdir -p /etc/nginx/ssl
sudo tee /etc/nginx/ssl/your-domain.com.pem > /dev/null <<'EOF'
... your certificate ...
EOF
sudo tee /etc/nginx/ssl/your-domain.com.key > /dev/null <<'EOF'
... your private key ...
EOF
sudo chmod 600 /etc/nginx/ssl/your-domain.com.key
```

---

## 🔧 传统部署（PM2）

### 适用场景
- 不使用 Docker
- 需要更多系统控制
- 多个 Node.js 应用共存

### 步骤 1: 在云服务器上安装依赖

```bash
# 克隆代码
git clone your-repo-url
cd context-os

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 PM2
sudo npm install -g pm2

# 安装项目依赖
npm ci --production
```

### 步骤 2: 构建应用

```bash
npm run build
```

### 步骤 3: 配置环境变量

创建 `.env` 文件:
```bash
cp .env.example .env
nano .env
```

配置关键变量:
```bash
# 数据库
DATABASE_URL=/data/context-os.db

# Qdrant
QDRANT_URL=http://localhost:6333

# LiteLLM
LITELLM_BASE_URL=http://localhost:4000
LITELLM_API_KEY=

# 第三方 API
SILICONFLOW_API_KEY=sk-xxx
DASHSCOPE_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx

# 存储（腾讯云 COS）
COS_SECRET_ID=xxx
COS_SECRET_KEY=xxx
COS_BUCKET=xxx
COS_REGION=ap-guangzhou

# JWT
JWT_SECRET=your-super-secret-key

# 生产环境
NODE_ENV=production
```

### 步骤 4: 创建 PM2 配置文件

创建 `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'context-os',
    script: '.next/standalone/server.js',  // ← 使用 standalone
    instances: 1,                           // 单实例
    exec_mode: 'fork',                      // fork 模式
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    watch: false
  }]
}
```

### 步骤 5: 启动应用

```bash
# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs context-os

# 设置开机自启
pm2 startup
pm2 save
```

### 步骤 6: 配置 Nginx

（与 Docker 部署相同，见上文）

---

## 🔍 故障排查

### 问题 1: JavaScript Chunk 404 错误

**症状**:
```
Failed to load resource: the server responded with a status of 404
Refused to execute script because MIME type ('text/plain') is not executable
```

**原因**: 启动命令与 standalone 配置不匹配

**解决方案**:

| 环境 | 正确命令 |
|------|---------|
| 本地开发 | `npm run dev` |
| 本地测试 | `npm start` |
| 云服务器 | `npm run start:standalone` |
| Docker | `CMD ["node", "server.js"]` |

**检查清单**:
- [ ] `next.config.ts` 中 `output: 'standalone'` 已启用
- [ ] 运行 `npm run build` 生成了 standalone 文件
- [ ] 使用正确的启动命令
- [ ] 检查 `.next/standalone/server.js` 文件存在

### 问题 2: Docker 容器无法启动

**症状**:
```
Error: Cannot find module '/app/server.js'
```

**原因**: Dockerfile 复制路径错误

**解决方案**:
```dockerfile
# 确保 Dockerfile 包含这些行
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
```

### 问题 3: 数据库连接失败

**症状**:
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**解决方案**:
```bash
# 1. 创建数据目录
mkdir -p /app/data

# 2. 设置权限
chmod 755 /app/data

# 3. 检查 .env 配置
DATABASE_URL=/data/context-os.db
```

### 问题 4: LiteLLM 连接失败

**症状**:
```
Error: connect ECONNREFUSED 127.0.0.1:4000
```

**解决方案**:
```bash
# 1. 检查 LiteLLM 服务状态
docker ps | grep litellm

# 2. 检查健康状态
curl http://localhost:4000/health

# 3. 检查环境变量
echo $LITELLM_BASE_URL
# 应该输出: http://localhost:4000

# 4. 重启 LiteLLM
docker-compose restart litellm
```

---

## 📊 性能优化建议

### 1. 启用 gzip 压缩（Nginx）

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript
           application/x-javascript application/xml+rss
           application/javascript application/json;
```

### 2. 配置静态文件缓存

```nginx
location /_next/static {
    alias /app/.next/static;
    expires 365d;
    add_header Cache-Control "public, immutable";
}

location /static {
    alias /app/public/static;
    expires 30d;
    add_header Cache-Control "public";
}
```

### 3. PM2 集群模式（可选）

如果服务器有多核 CPU：

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'context-os',
    script: '.next/standalone/server.js',
    instances: 'max',  // 使用所有 CPU 核心
    exec_mode: 'cluster'
  }]
}
```

---

## ✅ 部署检查清单

### 部署前
- [ ] 代码已提交到 Git
- [ ] `.env` 文件已配置
- [ ] 所有必需的服务已安装（Node.js 18+, Docker/PM2）
- [ ] DNS 已解析到服务器 IP

### 部署中
- [ ] 代码已拉取到服务器
- [ ] 依赖已安装（`npm ci` 或 Docker 构建）
- [ ] 应用已构建（`npm run build`）
- [ ] 数据库已初始化
- [ ] LiteLLM 服务运行正常

### 部署后
- [ ] 应用启动成功（`pm2 status` 或 `docker ps`）
- [ ] 可以访问主页（http://your-domain.com）
- [ ] 用户可以注册/登录
- [ ] 可以创建知识库
- [ ] 可以上传文档
- [ ] 搜索和聊天功能正常
- [ ] Nginx 反向代理正常
- [ ] SSL 证书有效
- [ ] 日志正常（无错误）

---

## 🔄 更新部署流程

### Docker 方式
```bash
# 1. 拉取最新代码
git pull

# 2. 构建新镜像
docker build -t context-os:v1.0.1 .

# 3. 停止旧容器
docker stop context-os
docker rm context-os

# 4. 启动新容器
docker run -d \
  --name context-os \
  -p 3000:3000 \
  --restart unless-stopped \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/.env:/app/.env:ro \
  context-os:v1.0.1

# 5. 验证
curl http://localhost:3000/api/health
```

### PM2 方式
```bash
# 1. 拉取最新代码
git pull

# 2. 安装依赖
npm ci --production

# 3. 重新构建
npm run build

# 4. 重启应用
pm2 restart context-os

# 5. 查看日志
pm2 logs context-os --lines 50
```

---

## 📞 获取帮助

如果遇到问题：
1. 查看 [docs/](docs/) 目录下的其他文档
2. 检查日志文件（`logs/err.log`, `logs/out.log`）
3. 运行 `npm run selfcheck` 进行系统自检
4. 查看 GitHub Issues

---

**最后更新**: 2026-01-19
**适用版本**: Context-OS v0.1.0
