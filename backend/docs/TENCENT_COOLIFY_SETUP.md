# Context OS 腾讯云全栈部署方案（Coolify版）

**架构**：腾讯云全家桶 + Coolify容器化管理

---

## 🎯 目标架构

```
腾讯云
├── 轻量应用服务器A (2C2G)
│   ├── Coolify (端口8000)
│   │   ├── ONEAPI容器 (端口3001)
│   │   ├── Redis容器 (端口6379)
│   │   └── Context OS容器 (端口3000)
│   └── 挂载存储桶
│
├── 轻量应用服务器B (2C2G)
│   └── Qdrant (Docker)
│
└── COS对象存储
    └── context-os-files
```

**成本**：¥140-210/月
- 轻量服务器A：¥50/月
- 轻量服务器B：¥70/月
- COS存储：¥10-20/月
- 域名+SSL：¥10-50/月

---

## 📋 资源准备

### 需要购买的腾讯云资源

| 资源 | 配置 | 数量 | 月成本 |
|------|------|------|--------|
| **轻量应用服务器A** | 2C2G 50GB | 1 | ¥50 |
| **轻量应用服务器B** | 2C2G 50GB | 1 | ¥70 |
| **COS存储桶** | 50GB | 1 | ¥10-20 |
| **域名**（可选） | .com | 1 | ¥10-50 |

**总计**：¥140-200/月

---

## 🚀 部署步骤

## 第一阶段：购买和初始化服务器

### 1.1 购买轻量应用服务器A

1. 登录腾讯云控制台
2. 进入"轻量应用服务器"
3. 点击"新建"
4. 配置：
   ```
   镜像: Ubuntu 20.04 或 22.04
   套餐: 2核2GB 50GB SSD
   地域: 广州/上海/北京（建议广州）
   数量: 1台
   主机名: context-os-main
   ```
5. 点击"立即购买"
6. 等待创建完成（3-5分钟）

**记录信息**：
```
公网IP: _______________
用户名: root
密码: _______________
```

### 1.2 购买轻量应用服务器B（Qdrant）

1. 同上流程
2. 配置：
   ```
   镜像: Ubuntu 20.04
   套餐: 2核2GB 50GB SSD
   地域: 同服务器A（重要！）
   主机名: context-os-qdrant
   ```

**记录信息**：
```
公网IP: _______________
内网IP: _______________ (重要！用于内网通信)
密码: _______________
```

### 1.3 创建COS存储桶

1. 进入"对象存储COS"
2. 点击"创建存储桶"
3. 配置：
   ```
   存储桶名称: context-os-files-{appid}
   所属地域: 广州（与服务器同地域）
   访问权限: 私有读写
   ```
4. 点击"创建"

### 1.4 配置安全组

**服务器A安全组**：
| 规则 | 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|------|
| 入站 | TCP | 80 | 0.0.0.0/0 | HTTP |
| 入站 | TCP | 443 | 0.0.0.0/0 | HTTPS |
| 入站 | TCP | 8000 | 0.0.0.0/0 | Coolify |
| 入站 | TCP | 22 | 你的IP | SSH |

**服务器B安全组**：
| 规则 | 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|------|
| 入站 | TCP | 6333 | 服务器A内网IP | Qdrant |
| 入站 | TCP | 22 | 你的IP | SSH管理 |

---

## 第二阶段：部署Qdrant（服务器B）

### 2.1 SSH登录服务器B

```bash
ssh root@<服务器B公网IP>
# 或使用腾讯云控制台的"登录"按钮
```

### 2.2 安装Docker

```bash
# 更新系统
apt update && apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com | sh

# 启动Docker
systemctl start docker
systemctl enable docker

# 验证
docker --version
```

### 2.3 部署Qdrant

```bash
# 创建数据目录
mkdir -p /data/qdrant

# 运行Qdrant容器
docker run -d --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /data/qdrant:/qdrant/storage \
  --restart unless-stopped \
  qdrant/qdrant:latest

# 验证部署
curl http://localhost:6333/

# 应该返回: {"title":"qdrant","version":"..."}
```

### 2.4 配置防火墙（可选）

```bash
# 只允许服务器A内网IP访问
ufw allow from <服务器A内网IP> to any port 6333
ufw enable
```

**记录Qdrant信息**：
```
Qdrant URL: http://<服务器B内网IP>:6333
```

---

## 第三阶段：安装Coolify（服务器A）

### 3.1 SSH登录服务器A

```bash
ssh root@<服务器A公网IP>
```

### 3.2 安装Docker

```bash
# 更新系统
apt update && apt upgrade -y

# 安装必要工具
apt install -y curl git wget nginx

# 安装Docker
curl -fsSL https://get.docker.com | sh

# 启动Docker
systemctl start docker
systemctl enable docker

# 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证
docker --version
docker-compose --version
```

### 3.3 安装Coolify

**方法1: 自动安装脚本（推荐）**

```bash
# 下载并运行安装脚本
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 安装过程中会要求配置：
# - 数据库密码（自动生成）
# - Coolify管理员密码
# - 域名（可选）

# 安装完成后查看信息
cat /data/coolify/source/.env
```

**方法2: Docker Compose安装**

```bash
# 创建数据目录
mkdir -p /data/coolify

# 创建docker-compose.yml
cat > /data/coolify/docker-compose.yml << 'EOF'
version: "3.8"

services:
  coolify:
    image: ghcr.io/coollabsio/coolify:latest
    container_name: coolify
    restart: always
    ports:
      - "8000:3000"
    environment:
      - APP_ID=local
      - APP_KEY=base64:<生成一个32字符的base64字符串>
      - DB_HOST=coolify-db
      - DB_USER=coolify
      - DB_PASSWORD=coolify
      - DB_DATABASE=coolify
      - REDIS_HOST=coolify-redis
      - REDIS_PORT=6379
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /data/coolify:/data/coolify
    depends_on:
      - coolify-db
      - coolify-redis

  coolify-db:
    image: mysql:8.0
    container_name: coolify-db
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=coolify
      - MYSQL_DATABASE=coolify
      - MYSQL_USER=coolify
      - MYSQL_PASSWORD=coolify
    volumes:
      - /data/coolify/db:/var/lib/mysql

  coolify-redis:
    image: redis:7-alpine
    container_name: coolify-redis
    restart: always
    volumes:
      - /data/coolify/redis:/data

volumes:
  coolify-db:
  coolify-redis:
EOF

# 启动Coolify
cd /data/coolify
docker-compose up -d

# 查看日志
docker-compose logs -f coolify
```

### 3.4 访问Coolify

```bash
# 访问地址
http://<服务器A公网IP>:8000

# 首次访问会要求设置管理员账号
# 记录用户名和密码
```

**记录Coolify信息**：
```
Coolify URL: http://<服务器A公网IP>:8000
管理员账号: _______________
管理员密码: _______________
```

---

## 第四阶段：在Coolify中部署服务

### 4.1 登录Coolify

1. 访问 `http://<服务器A公网IP>:8000`
2. 使用管理员账号登录
3. 首次登录会要求初始化设置

### 4.2 添加服务器（自动添加）

Coolify会自动检测本地Docker，不需要手动添加。

### 4.3 部署ONEAPI

#### 步骤1: 创建新项目

1. 在Coolify控制台，点击 "New Project"
2. 项目名称：`one-api`
3. 选择 "Docker Compose"

#### 步骤2: 配置Docker Compose

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
    networks:
      - oneapi-network

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
    networks:
      - oneapi-network

networks:
  oneapi-network:
    driver: bridge
```

#### 步骤3: 部署

1. 点击 "Deploy"
2. 等待部署完成（2-5分钟）
3. 查看 "Logs" 确认启动成功

#### 步骤4: 配置ONEAPI

1. 访问 `http://<服务器A公网IP>:3001`
2. 查看日志获取初始密码：
   ```bash
   docker logs one-api
   ```
3. 登录后修改密码
4. 添加API渠道（OpenAI、DeepSeek等）

#### 步骤5: 创建Token

1. 进入 "令牌" 页面
2. 点击 "新建令牌"
3. 记录Token：`sk-xxxx`

**记录ONEAPI信息**：
```
ONEAPI_URL: http://<服务器A内网IP>:3001
ONEAPI_KEY: sk-xxxx
```

### 4.4 部署Redis（独立容器）

#### 步骤1: 创建项目

1. "New Project" → "Docker"
2. 项目名称：`redis`

#### 步骤2: 配置Redis

**Docker配置**：
```
Image: redis:7-alpine
Name: redis
Ports: 6379:6379
```

**Volumes**：
```
Container: /data
Host: /data/redis
```

**Command**：
```
redis-server --appendonly yes
```

**Environment Variables**（可选，启用密码）：
```
- REDIS_PASSWORD=your_secure_password
```

#### 步骤3: 部署

点击 "Deploy" 并等待完成。

**记录Redis信息**：
```
REDIS_HOST: <服务器A内网IP>
REDIS_PORT: 6379
REDIS_PASSWORD: (如果有)
```

---

## 第五阶段：配置COS存储桶挂载

### 5.1 方法选择

**推荐顺序**：
1. CFS（腾讯云文件存储）- 性能最好，实时同步
2. cos-fuse（官方工具）- 稳定
3. rclone - 灵活但稍有延迟

### 5.2 使用CFS挂载（推荐）

#### 步骤1: 购买CFS文件存储

1. 进入"文件存储CFS"
2. 点击"新建文件系统"
3. 配置：
   ```
   文件系统名称: context-os-storage
   地域: 广州
   协议类型: NFS
   容量: 10GB（可扩展）
   ```
4. 点击"购买"

#### 步骤2: 配置挂载目标

1. 进入文件系统详情
2. 点击"挂载点管理" → "添加挂载目标"
3. 选择服务器A
4. 挂载目录：`/mnt/cos-storage`

#### 步骤3: 在服务器上挂载

```bash
# 安装NFS客户端
apt install -y nfs-common

# 创建挂载点
mkdir -p /mnt/cos-storage

# 挂载（使用控制台提供的命令）
mount -t nfs -o vers=4.0,noresvport <CFS_IP>:/ /mnt/cos-storage

# 验证
df -h | grep cos-storage

# 写入测试
echo "test" > /mnt/cos-storage/test.txt

# 配置自动挂载
echo "<CFS_IP>:/ /mnt/cos-storage nfs4 defaults 0 0" >> /etc/fstab
```

### 5.3 使用cos-fuse（备选方案）

```bash
# 安装cosfs
wget https://github.com/tencentyun/cosfs/releases/download/v1.2.1/cosfs_1.2.1 ubuntu20.04_amd64.deb
dpkg -i cosfs_1.2.1 ubuntu20.04_amd64.deb

# 配置密钥
echo "<bucket-name> <SecretId> <SecretKey>" > /etc/passwd-cosfs
chmod 640 /etc/passwd-cosfs

# 创建挂载点
mkdir -p /mnt/cos-bucket

# 挂载
cosfs -ourl=http://cos.ap-guangzhou.myqcloud.com \
  -odbglevel=info \
  -onoxattr \
  context-os-files /mnt/cos-bucket
```

---

## 第六阶段：在Coolify中部署Context OS

### 6.1 创建项目

1. 在Coolify中，点击 "New Project"
2. 选择 "Git Repository" 或 "Dockerfile"

### 6.2 方式1: 使用Git仓库（推荐）

#### 步骤1: 推送代码到Git

```bash
# 本地操作
cd context-os
git init
git add .
git commit -m "Initial commit"

# 推送到GitHub/GitLab
git remote add origin <你的仓库地址>
git push -u origin main
```

#### 步骤2: 在Coolify中连接Git

1. "New Project" → "Git Repository"
2. 输入仓库URL：`https://github.com/your-username/context-os.git`
3. 选择分支：`main`
4. 配置构建设置：
   ```
   Build Path: /
   Dockerfile: Dockerfile
   Port: 3000
   ```

#### 步骤3: 创建Dockerfile

```dockerfile
# 在项目根目录创建 Dockerfile
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

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### 步骤4: 配置next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
```

#### 步骤5: 配置环境变量

在Coolify项目的 "Environment Variables" 中添加：

```bash
# 数据库
DATABASE_URL=/app/data/context-os.db

# JWT
JWT_SECRET=<your-secret-key>

# 文件存储
STORAGE_TYPE=local
UPLOAD_DIR=/app/uploads

# ONEAPI（内网访问）
ONEAPI_BASE_URL=http://<服务器A内网IP>:3001
ONEAPI_KEY=sk-xxxx

# Embedding
EMBEDDING_API_KEY=sk-xxxx
EMBEDDING_BASE_URL=http://<服务器A内网IP>:3001

# Redis（内网访问）
REDIS_HOST=<服务器A内网IP>
REDIS_PORT=6379
REDIS_URL=redis://<服务器A内网IP>:6379

# Qdrant（服务器B内网）
QDRANT_URL=http://<服务器B内网IP>:6333
```

#### 步骤6: 配置数据卷

```
Container: /app/data
Host: /data/context-os
```

```
Container: /app/uploads
Host: /mnt/cos-storage
```

#### 步骤7: 部署

1. 点击 "Deploy"
2. 等待构建和部署（5-10分钟）
3. 查看日志确认启动成功

### 6.3 方式2: 使用Docker Compose

如果不想用Git，可以直接用Docker Compose：

在Coolify中创建 "Docker Compose" 项目：

```yaml
version: '3.8'

services:
  context-os:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "npm install && npm run build && npm start"
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=/app/data/context-os.db
      - JWT_SECRET=your-secret-key
      - ONEAPI_BASE_URL=http://host.docker.internal:3001
      - ONEAPI_KEY=sk-xxxx
      - REDIS_HOST=host.docker.internal
      - REDIS_PORT=6379
      - QDRANT_URL=http://<服务器B内网IP>:6333
    volumes:
      - /data/context-os:/app/data
      - /mnt/cos-storage:/app/uploads
    restart: always
```

---

## 第七阶段：配置域名和SSL

### 7.1 配置DNS解析

1. 进入"DNS解析"
2. 添加记录：
   ```
   主机记录: @
   记录类型: A
   记录值: <服务器A公网IP>
   TTL: 600
   ```

### 7.2 申请SSL证书

1. 进入"SSL证书"
2. 申请免费证书（Cloudflare Origin）
3. 域名验证：DNS验证
4. 下载证书（Nginx格式）

### 7.3 配置Nginx

```bash
# 安装Nginx
apt install -y nginx

# 上传证书文件到 /etc/nginx/ssl/
# - 1_yourdomain.com_bundle.crt
# - 2_yourdomain.com.key

# 创建配置文件
cat > /etc/nginx/conf.d/context-os.conf << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/1_yourdomain.com_bundle.crt;
    ssl_certificate_key /etc/nginx/ssl/2_yourdomain.com.key;

    ssl_protocols TLSv1.2 TLSv1.3;

    # Coolify
    location /coolify/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # Context OS
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件访问
    location /uploads/ {
        alias /mnt/cos-storage/;
        internal;
    }
}
EOF

# 测试配置
nginx -t

# 启动Nginx
systemctl start nginx
systemctl enable nginx
```

---

## 第八阶段：测试验证

### 8.1 测试各服务

```bash
# 1. 测试Qdrant
curl http://<服务器B内网IP>:6333/

# 2. 测试ONEAPI
curl http://localhost:3001

# 3. 测试Redis
redis-cli -h localhost ping

# 4. 测试应用
curl https://yourdomain.com
```

### 8.2 功能测试

1. ✅ 访问域名打开应用
2. ✅ 注册账号
3. ✅ 创建知识库
4. ✅ 上传文档
5. ✅ 测试搜索功能

---

## 🎯 完整架构总结

```
腾讯云广州地域

服务器A (2C2G) - IP: x.x.x.x
├── Docker
│   ├── Coolify容器 (端口8000)
│   ├── ONEAPI容器 (端口3001)
│   ├── Redis容器 (端口6379)
│   └── Context OS容器 (端口3000)
├── Nginx (端口80/443)
└── 挂载存储 /mnt/cos-storage (CFS)

服务器B (2C2G) - IP: y.y.y.y
├── Docker
│   └── Qdrant容器 (端口6333)
└── 数据目录 /data/qdrant

COS存储桶
└── context-os-files (通过CFS挂载到服务器A)
```

---

## 💰 成本明细

| 资源 | 配置 | 月成本 | 年成本 |
|------|------|--------|--------|
| 服务器A | 2C2G Ubuntu | ¥50 | ¥500 |
| 服务器B | 2C2G Ubuntu | ¥70 | ¥700 |
| CFS存储 | 10GB | ¥15 | ¥150 |
| COS存储桶 | 50GB | ¥10 | ¥100 |
| 域名+SSL | .com | ¥10-50 | ¥120-600 |
| **总计** | | **¥155-195** | **¥1570-2050** |

**年付优惠**：约8-9折

---

## ✅ 部署完成检查清单

### 服务器配置
- [ ] 两台轻量服务器已购买
- [ ] Docker已安装
- [ ] 安全组已配置
- [ ] 内网互通已测试

### 服务部署
- [ ] Coolify已安装并可访问
- [ ] ONEAPI已部署并配置
- [ ] Redis已部署并运行
- [ ] Qdrant已部署并运行
- [ ] Context OS已部署

### 存储配置
- [ ] CFS文件存储已购买
- [ ] 存储已挂载到服务器A
- [ ] 文件读写测试通过

### 网络配置
- [ ] 域名DNS已解析
- [ ] SSL证书已安装
- [ ] Nginx已配置
- [ ] HTTPS访问正常

### 功能验证
- [ ] 用户注册/登录
- [ ] 知识库创建
- [ ] 文档上传
- [ ] 搜索功能

---

## 🔧 运维管理

### 使用Coolify管理

1. 访问 `http://yourdomain.com/coolify/`
2. 查看所有容器状态
3. 查看日志
4. 重启服务
5. 更新部署

### 数据备份

**自动备份脚本**：
```bash
cat > /data/scripts/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)

# 备份SQLite
tar -czf /backup/context-os-$DATE.tar.gz /data/context-os/

# 备份ONEAPI数据库
docker exec oneapi-db mysqldump -uroot -poneapi one-api > /backup/oneapi-$DATE.sql

# 备份到COS
aws s3 cp /backup/context-os-$DATE.tar.gz s3://context-os-backups/
aws s3 cp /backup/oneapi-$DATE.sql s3://context-os-backups/

# 删除7天前的备份
find /backup -name "*.tar.gz" -mtime +7 -delete
find /backup -name "*.sql" -mtime +7 -delete
EOF

chmod +x /data/scripts/backup.sh

# 添加定时任务
crontab -e
# 每天凌晨2点备份
0 2 * * * /data/scripts/backup.sh
```

### 监控告警

在Coolify中配置：
- 资源监控（CPU、内存、磁盘）
- 健康检查
- 自动重启
- 钉钉/企业微信通知

---

## 🎉 部署完成！

现在你拥有：
- ✅ 完全在腾讯云上的架构
- ✅ Coolify统一管理所有服务
- ✅ ONEAPI统一管理LLM
- ✅ Redis提供缓存加速
- ✅ 内网互通，低延迟
- ✅ 成本可控

**下一步**：
1. 在ONEAPI中添加你的LLM渠道
2. 配置文档处理流程（如果需要）
3. 根据实际使用调整资源配置
