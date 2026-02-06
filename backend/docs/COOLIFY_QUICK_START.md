# Coolify部署Context OS - 快速清单

## 📦 购买清单

### 腾讯云资源

- [ ] **轻量服务器A** (2C2G Ubuntu) - ¥50/月
  
  - 用途：Coolify + ONEAPI + Redis + Context OS
  - 主机名：context-os-main
  - 公网IP：_______________

- [ ] **轻量服务器B** (2C2G Ubuntu) - ¥70/月
  
  - 用途：Qdrant向量数据库
  - 主机名：context-os-qdrant
  - 公网IP：_______________
  - 内网IP：_______________ (重要！)

- [ ] **CFS文件存储** (10GB) - ¥15/月
  
  - 用途：文件存储挂载
  - 挂载目录：/mnt/cos-storage

- [ ] **域名** (.com) - ¥10-50/年
  
  - 用途：HTTPS访问

**总成本**：¥155-195/月

---

## 🚀 部署流程

### 第1步：配置服务器B（Qdrant）- 15分钟

```bash
# SSH登录服务器B
ssh root@<服务器B公网IP>

# 安装Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 部署Qdrant
mkdir -p /data/qdrant
docker run -d --name qdrant \
  -p 6333:6333 \
  -v /data/qdrant:/qdrant/storage \
  --restart unless-stopped \
  qdrant/qdrant:latest

# 验证
curl http://localhost:6333/
```

**记录信息**：

```
Qdrant URL: http://10.5.4.5:6333
```

---

### 第2步：安装Coolify（服务器A）- 30分钟

```bash
# SSH登录服务器A
ssh root@<服务器A公网IP>

# 安装Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 安装Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 等待安装完成，记录访问信息
```

**记录信息**：

```
Coolify URL: http://<服务器A公网IP>:8000
管理员账号: xingchuan    
管理员密码: Xingchuan0105!
```

---

### 第3步：配置CFS挂载（服务器A）- 15分钟

```bash
# 在服务器A上
# 安装NFS客户端
apt install -y nfs-common

# 创建挂载点
mkdir -p /mnt/cos-storage

# 挂载（使用控制台提供的命令）
mount -t nfs -o vers=4.0,noresvport <CFS_IP>:/ /mnt/cos-storage

# 配置自动挂载
echo "<CFS_IP>:/ /mnt/cos-storage nfs4 defaults 0 0" >> /etc/fstab

# 测试
echo "test" > /mnt/cos-storage/test.txt
```

---

### 第4步：在Coolify中部署ONEAPI - 20分钟

#### 4.1 登录Coolify

访问：`http://<服务器A公网IP>:8000`

#### 4.2 创建ONEAPI项目

1. "New Project" → "Docker Compose"
2. 粘贴配置（见下方）
3. 点击 "Deploy"

**Docker Compose配置**：

```yaml
version: '3.8'

services:
  one-api:
    image: ghcr.io/songquanpeng/one-api:latest
    container_name: one-api
    restart: always
    ports:
      - "3001:3000"
    environment:
      - TZ=Asia/Shanghai
      - SQL_DSN=one-api:oneapi@tcp(oneapi-db:3306)/one-api
    volumes:
      - /data/oneapi:/data
    depends_on:
      - oneapi-db

  oneapi-db:
    image: mysql:8.0
    container_name: oneapi-db
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=oneapi
      - MYSQL_DATABASE=one-api
      - MYSQL_USER=one-api
      - MYSQL_PASSWORD=oneapi
    volumes:
      - /data/oneapi-db:/var/lib/mysql
```

#### 4.3 配置ONEAPI

1. 访问：`http://<服务器A公网IP>:3001`
2. 查看日志获取初始密码
   
   账户：xc
   
   密码：xc880105
3. 修改密码
4. 添加API渠道（OpenAI、DeepSeek等）
5. 创建Token，记录：`sk-xxxx`

---

### 第5步：在Coolify中部署Redis - 10分钟

1. "New Project" → "Docker"
2. 配置：
   - Image: `redis:7-alpine`
   - Ports: `6379:6379`
   - Volumes: `/data/redis:/data`
   - Command: `redis-server --appendonly yes`
3. Deploy

---

### 第6步：在Coolify中部署Context OS - 30分钟

#### 6.1 准备代码

```bash
# 本地操作
cd context-os

# 创建Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
EOF

# 更新next.config.js
# 添加: output: 'standalone'

# 推送到Git
git add .
git commit -m "Add Dockerfile"
git push
```

#### 6.2 在Coolify中创建项目

1. "New Project" → "Git Repository"
2. 输入仓库URL
3. 配置环境变量：

```bash
DATABASE_URL=/app/data/context-os.db
JWT_SECRET=<your-secret-key>

# ONEAPI（内网）
ONEAPI_BASE_URL=http://host.docker.internal:3001
ONEAPI_KEY=sk-xxxx
EMBEDDING_API_KEY=sk-xxxx
EMBEDDING_BASE_URL=http://host.docker.internal:3001

# Redis（内网）
REDIS_HOST=host.docker.internal
REDIS_PORT=6379

# Qdrant（服务器B内网）
QDRANT_URL=http://<服务器B内网IP>:6333
```

4. 配置数据卷：
   
   - `/app/data` → `/data/context-os`
   - `/app/uploads` → `/mnt/cos-storage`

5. Deploy

---

### 第7步：配置域名和SSL - 30分钟

#### 7.1 配置Nginx

```bash
# 在服务器A上
apt install -y nginx

# 配置文件
cat > /etc/nginx/conf.d/context-os.conf << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
EOF

# 启动
nginx -t
systemctl start nginx
systemctl enable nginx
```

#### 7.2 配置DNS和SSL

1. DNS解析指向服务器A公网IP
2. 申请SSL证书
3. 上传证书到 `/etc/nginx/ssl/`
4. 重启Nginx

---

## ✅ 测试验证

```bash
# 1. 测试Qdrant
curl http://<服务器B内网IP>:6333/

# 2. 测试ONEAPI
curl http://localhost:3001

# 3. 测试Redis
redis-cli ping

# 4. 测试应用
curl https://yourdomain.com
```

---

## 🔧 关键配置信息

### 服务器A内网IP：_______________

### 服务器B内网IP：_______________

### ONEAPI

- URL: `http://<服务器A内网IP>:3001`
- Key: `sk-xxxx`

### Redis

- Host: `<服务器A内网IP>`
- Port: `6379`

### Qdrant

- URL: `http://<服务器B内网IP>:6333`

### 存储

- 挂载点: `/mnt/cos-storage`

---

## 📊 服务端口映射

| 服务         | 容器端口 | 主机端口 | 访问方式           |
| ---------- | ---- | ---- | -------------- |
| Coolify    | 3000 | 8000 | http://IP:8000 |
| ONEAPI     | 3000 | 3001 | http://IP:3001 |
| Redis      | 6379 | 6379 | -              |
| Context OS | 3000 | 3000 | https://域名     |
| Qdrant     | 6333 | 6333 | 内网             |

---

## ⚠️ 重要提示

### 1. 内网通信

- ONEAPI、Redis在服务器A，使用`host.docker.internal`访问
- Qdrant在服务器B，使用**内网IP**访问

### 2. 数据持久化

- 所有服务都要配置数据卷挂载
- 定期备份到COS

### 3. 安全配置

- 关闭不必要的端口
- 使用防火墙限制访问
- 定期更新密码

---

## 🆘 常见问题

### Q: Coolify无法访问？

A: 检查安全组8000端口是否开放

### Q: ONEAPI无法连接？

A: 检查容器是否运行：`docker ps | grep one-api`

### Q: 文件上传失败？

A: 检查CFS挂载：`df -h | grep cos`

### Q: 搜索无结果？

A: 检查Qdrant连接：`curl http://<Qdrant内网IP>:6333/`

---

## 📞 获取帮助

- 详细文档：`TENCENT_COOLIFY_SETUP.md`
- Coolify文档：https://coolify.io/docs
- Qdrant文档：https://qdrant.tech/documentation
- ONEAPI文档：https://github.com/songquanpeng/one-api

---

**预计总耗时**: 2.5-3小时
**难度等级**: ⭐⭐⭐ (中等)
