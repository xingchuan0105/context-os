# Context OS 混合云部署方案

**架构特点**：
- 腾讯云：前端应用 + 文件存储 + Qdrant向量库
- 阿里云：Coolify + ONEAPI + Redis

**优势**：
- 利用Coolify简化服务部署
- ONEAPI集中管理多个LLM
- Redis提供缓存和会话管理
- 降低单云依赖风险

---

## 📊 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      Context OS 混合云架构                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   阿里云 ECS     │         │   腾讯云 Lighthouse│         │
│  │                 │         │                  │         │
│  │  ┌───────────┐  │         │  ┌────────────┐  │         │
│  │  │ Coolify   │  │         │  │ Next.js    │  │         │
│  │  │           │  │         │  │ (前端)     │  │         │
│  │  │ ┌───────┐ │  │         │  └────────────┘  │         │
│  │  │ │ONEAPI │ │  │◄───────►│                  │         │
│  │  │ └───────┘ │  │  公网    │  ┌────────────┐  │         │
│  │  │           │  │         │  │   SQLite   │  │         │
│  │  │ ┌───────┐ │  │         │  │  (数据库)  │  │         │
│  │  │ │ Redis │ │  │         │  └────────────┘  │         │
│  │  │ └───────┘ │  │         │                  │         │
│  │  └───────────┘  │         │  ┌────────────┐  │         │
│  └──────────────────┘         │  │挂载存储桶  │  │         │
│                               │  │(COS/NFS)   │  │         │
│                               │  └────────────┘  │         │
│                               └──────────────────┘         │
│                                         │                  │
│                                         │ 内网             │
│                               ┌─────────▼─────────┐        │
│                               │   Qdrant Server   │        │
│                               │   (腾讯云)        │        │
│                               └───────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 部署目标

### 阿里云服务器（已有）
- **Coolify**：自托管平台
- **ONEAPI**：LLM统一网关
- **Redis**：缓存和会话存储

### 腾讯云服务器（需要购买）
- **Next.js应用**：Context OS前端
- **SQLite数据库**：元数据存储
- **挂载存储桶**：文件存储
- **Qdrant**：向量数据库（可选独立服务器）

---

## 📋 资源清单

### 阿里云（已有）
- [x] ECS服务器
- [ ] Coolify已安装
- [ ] ONEAPI服务
- [ ] Redis服务

### 腾讯云（需要购买）
| 资源 | 规格 | 用途 | 月成本 |
|------|------|------|--------|
| **轻量应用服务器** | 2C2G 50GB | Next.js + SQLite | ¥50 |
| **COS存储桶** | 50GB+ | 文件存储（挂载） | ¥10-20 |
| **Qdrant服务器**（可选） | 2C2G | 向量数据库 | ¥70 |
| **域名+SSL** | - | HTTPS访问 | ¥10-50 |

**总成本**: ¥70-140/月（或¥140-210/月含独立Qdrant）

---

## 🚀 部署步骤

## 第一部分：阿里云 - Coolify部署

### 1.1 安装Coolify

```bash
# SSH登录阿里云服务器
ssh root@<阿里云服务器IP>

# 安装Docker（如果没有）
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 安装Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 等待安装完成，记录访问信息
# 默认端口: 8000 (或 3000)
# 默认账号: 查看 /data/coolify/source/.env
```

安装完成后：
1. 访问 `http://<阿里云服务器IP>:8000`
2. 完成初始化设置
3. 配置域名（可选）

### 1.2 在Coolify中部署ONEAPI

#### 方法1: 使用Docker Compose

在Coolify中创建新项目 → 选择 "Docker Compose"：

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
      - SQL_DSN=one-api:one-api@tcp(oneapi-db:3306)/one-api
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
      - MYSQL_ROOT_PASSWORD=one-api
      - MYSQL_DATABASE=one-api
      - MYSQL_USER=one-api
      - MYSQL_PASSWORD=one-api
    volumes:
      - /data/mysql:/var/lib/mysql
    networks:
      - oneapi-network

networks:
  oneapi-network:
    driver: bridge
```

#### 方法2: 预构建镜像

如果Coolify支持Git仓库：
1. Fork ONEAPI仓库
2. 在Coolify中连接Git仓库
3. 配置构建选项
4. 部署

#### ONEAPI配置

部署完成后：
1. 访问 `http://<阿里云IP>:3001` 或配置的域名
2. 默认密码：在日志中查看
3. 添加你的API渠道：
   - OpenAI
   - DeepSeek
   - 通义千问
   - 等等

**记录ONEAPI信息**：
```
ONEAPI_BASE_URL=http://<阿里云IP>:3001
ONEAPI_KEY=sk-xxxx (在界面中创建token)
```

### 1.3 在Coolify中部署Redis

在Coolify中创建新服务：

**方式1: 使用官方镜像**
- 服务类型：Docker
- 镜像：`redis:7-alpine`
- 端口映射：`6379:6379`
- 数据卷：`/data/redis:/data`
- 命令：`redis-server --appendonly yes`

**方式2: Docker Compose**
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - /data/redis:/data
    command: redis-server --appendonly yes
```

**配置Redis密码**（推荐）：
```yaml
command: redis-server --requirepass your_redis_password --appendonly yes
```

**记录Redis信息**：
```
REDIS_HOST=<阿里云IP>
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password (可选)
```

### 1.4 配置防火墙

在阿里云控制台：
1. 安全组规则 → 添加规则
2. 开放端口：
   - 8000（Coolify Web界面）
   - 3001（ONEAPI）
   - 6379（Redis，内网访问）
   - 22（SSH）

⚠️ **安全提示**：
- ONEAPI和Redis建议仅允许腾讯云服务器IP访问
- 使用防火墙规则限制来源IP

---

## 第二部分：腾讯云 - 存储桶挂载

### 2.1 购买轻量应用服务器

1. 进入腾讯云"轻量应用服务器"
2. 配置：
   ```
   镜像: CentOS 8.4 或 Ubuntu 20.04
   套餐: 2C2G 50GB SSD
   地域: 广州/上海
   ```
3. 购买并记录IP

### 2.2 配置COS存储桶

1. 创建存储桶：`context-os-files`
2. 设置权限：私有读写
3. **配置挂载**：

**选项A: 使用CFS（推荐）**

腾讯云提供CFS文件存储服务，可直接挂载到服务器：

```bash
# 在腾讯云控制台
1. 创建文件系统
2. 添加挂载目标（选择你的轻量服务器）
3. 记录挂载命令
```

在服务器上执行：
```bash
# 安装CFS客户端
yum install -y nfs-utils

# 创建挂载点
mkdir -p /mnt/cos-storage

# 挂载（使用控制台提供的命令）
mount -t nfs -o vers=4.0,noresvport <CFS_IP>:/ /mnt/cos-storage

# 验证
df -h | grep cos-storage

# 配置自动挂载
echo "<CFS_IP>:/ /mnt/cos-storage nfs4 defaults 0 0" >> /etc/fstab
```

**选项B: 使用rclone挂载COS**

如果需要直接挂载COS对象存储：

```bash
# 安装rclone
curl https://rclone.org/install.sh | bash

# 配置rclone
rclone config

# 按提示配置：
# name: cos
# type: s3
# provider: Other
# access_key_id: <你的SecretId>
# secret_access_key: <你的SecretKey>
# endpoint: cos.ap-guangzhou.myqcloud.com
# region: ap-guangzhou
# location_constraint: ap-guangzhou
# acl: private

# 挂载COS
mkdir -p /mnt/cos-bucket
rclone mount cos:context-os-files /mnt/cos-bucket \
  --allow-other \
  --vfs-cache-mode full \
  --daemon

# 配置自动挂载（systemd）
cat > /etc/systemd/system/rclone-cos.service << 'EOF'
[Unit]
Description=RClone COS Mount
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/rclone mount cos:context-os-files /mnt/cos-bucket \
  --allow-other \
  --vfs-cache-mode full \
  --log-file /var/log/rclone.log \
  --log-level INFO
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rclone-cos
systemctl start rclone-cos
```

**选项C: 使用cos-fuse（官方工具）**

```bash
# 安装cos-fuse
wget https://github.com/tencentyun/cosfs/releases/download/v1.2.1/cosfs-1.2.1-centos7.0.x86_64.rpm
rpm -ivh cosfs-1.2.1-centos7.0.x86_64.rpm

# 配置
cat > /etc/passwd-cosfs << 'EOF'
<context-bucket-name> <SecretId> <SecretKey>
EOF
chmod 640 /etc/passwd-cosfs

# 创建挂载点
mkdir -p /mnt/cos-bucket

# 挂载
cosfs -ourl=http://cos.ap-guangzhou.myqcloud.com \
  -odbglevel=info \
  -onoxattr \
  context-os-files /mnt/cos-bucket

# 配置自动挂载
echo "cosfs#context-os-files /mnt/cos-bucket cosfs _url=http://cos.ap-guangzhou.myqcloud.com,_noxsattr 0 0" >> /etc/fstab
```

### 2.3 验证挂载

```bash
# 检查挂载点
df -h | grep -E '(cos|cfs)'

# 创建测试文件
echo "test" > /mnt/cos-storage/test.txt

# 检查COS控制台，确认文件已同步
```

---

## 第三部分：腾讯云 - 部署应用

### 3.1 安装Node.js和依赖

```bash
# SSH登录腾讯云服务器
ssh root@<腾讯云服务器IP>

# 安装Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# 安装PM2
npm install -g pm2

# 安装Nginx
yum install -y nginx
```

### 3.2 部署代码

```bash
# 克隆代码
cd /var/www
git clone <your-repo> context-os
cd context-os

# 安装依赖
npm install

# 创建存储目录链接
mkdir -p /var/www/context-os/uploads
ln -s /mnt/cos-storage /var/www/context-os/uploads
```

### 3.3 配置环境变量

```bash
# 创建.env文件
cat > /var/www/context-os/.env << 'EOF'
# 数据库
DATABASE_URL=/var/www/context-os/data/context-os.db

# JWT认证
JWT_SECRET=<随机32位字符串>

# 文件存储（使用挂载的存储桶）
STORAGE_TYPE=local
UPLOAD_DIR=/var/www/context-os/uploads

# Qdrant（如果部署在同一服务器）
QDRANT_URL=http://localhost:6333

# ONEAPI（阿里云服务器）
ONEAPI_BASE_URL=http://<阿里云服务器公网IP>:3001
ONEAPI_KEY=sk-xxxx

# Embedding
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_API_KEY=<同ONEAPI_KEY>
EMBEDDING_BASE_URL=http://<阿里云服务器公网IP>:3001

# Redis（阿里云服务器）
REDIS_HOST=<阿里云服务器公网IP>
REDIS_PORT=6379
REDIS_PASSWORD=<如果有>
REDIS_URL=redis://:<密码>@<阿里云IP>:6379

# 消息队列（暂时不使用TDMQ）
ENABLE_QUEUE=false

# SCF回调（如果使用）
CALLBACK_BASE_URL=https://yourdomain.com
EOF

# 生成JWT密钥
openssl rand -base64 32
```

### 3.4 更新应用代码

由于文件存储改为本地挂载方式，需要调整上传逻辑：

**创建文件存储工具**：
```typescript
// lib/storage/local.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function saveFileToLocal(
  userId: string,
  kbId: string,
  fileName: string,
  buffer: Buffer
): Promise<{ path: string; url: string }> {
  // 创建目录
  const userDir = path.join(UPLOAD_DIR, userId, kbId);
  await fs.promises.mkdir(userDir, { recursive: true });

  // 生成唯一文件名
  const uniqueFileName = `${Date.now()}_${fileName}`;
  const filePath = path.join(userDir, uniqueFileName);

  // 保存文件
  await fs.promises.writeFile(filePath, buffer);

  return {
    path: filePath,
    url: `/uploads/${userId}/${kbId}/${uniqueFileName}`,
  };
}

export async function deleteFileLocal(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.error('Delete file error:', error);
  }
}
```

**更新文档上传API**：
```typescript
// app/api/documents/route.ts
import { saveFileToLocal } from '@/lib/storage/local';

// 在POST函数中替换COS上传为：
const uploadResult = await saveFileToLocal(
  user.id,
  kbId,
  file.name,
  buffer
);
```

### 3.5 配置Nginx

```nginx
# /etc/nginx/conf.d/context-os.conf
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # 静态文件（上传的文件）
    location /uploads/ {
        alias /var/www/context-os/uploads/;
        internal;  # 仅内部访问
    }

    # Next.js应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3.6 部署Qdrant（如果需要）

**选项A: Docker方式（推荐）**
```bash
# 安装Docker
curl -fsSL https://get.docker.com | sh

# 部署Qdrant
docker run -d --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /data/qdrant:/qdrant/storage \
  --restart unless-stopped \
  qdrant/qdrant:latest

# 验证
curl http://localhost:6333/
```

**选项B: 二进制方式**
```bash
# 下载Qdrant
wget https://github.com/qdrant/qdrant/releases/latest/download/qdrant-aarch64-unknown-linux-gnu.tar.gz
tar -xzf qdrant-aarch64-unknown-linux-gnu.tar.gz

# 运行
./qdrant --storage-path /data/qdrant
```

### 3.7 启动应用

```bash
cd /var/www/context-os

# 构建
npm run build

# 启动
pm2 start npm --name "context-os" -- start

# 保存配置
pm2 save
pm2 startup

# 查看日志
pm2 logs context-os
```

---

## 🔗 跨云网络配置

### 安全组配置

**阿里云安全组**：
```bash
# 入站规则
端口 3001（ONEAPI）→ 仅允许腾讯云服务器IP
端口 6379（Redis）→ 仅允许腾讯云服务器IP
端口 8000（Coolify）→ 仅允许你的IP
```

**腾讯云安全组**：
```bash
# 入站规则
端口 80/443 → 0.0.0.0/0（Web访问）
端口 22 → 仅允许你的IP
端口 3000 → 127.0.0.1（仅本地）
```

### 网络延迟优化

```bash
# 从腾讯云服务器测试阿里云连接
ping <阿里云IP>
curl http://<阿里云IP>:3001

# 如果延迟较高（>50ms），考虑：
# 1. 使用同一地域
# 2. 使用内网互联（如果支持）
# 3. 考虑将ONEAPI迁移到腾讯云
```

---

## ✅ 验证测试

### 1. 测试阿里云服务

```bash
# 测试ONEAPI
curl http://<阿里云IP>:3001

# 测试Redis（如果有密码）
redis-cli -h <阿里云IP> -a <password> ping
```

### 2. 测试腾讯云服务

```bash
# 测试应用
curl https://yourdomain.com

# 测试文件上传
curl -X POST https://yourdomain.com/api/documents \
  -F "file=@test.pdf" \
  -F "kb_id=test-kb"

# 验证文件是否在挂载目录
ls -lh /mnt/cos-storage/<user_id>/<kb_id>/
```

### 3. 端到端测试

1. 访问 `https://yourdomain.com`
2. 注册账号
3. 创建知识库
4. 上传文档
5. 等待处理
6. 测试搜索

---

## 💰 成本对比

### 混合云方案（当前）
- 阿里云ECS（已有）：¥？
- 腾讯云轻量服务器：¥50/月
- COS存储（挂载）：¥10-20/月
- Qdrant（可选）：¥0-70/月
- **总计**：¥60-140/月

### 全腾讯云方案（原方案）
- 轻量服务器A：¥50/月
- 轻量服务器B：¥70/月
- COS存储：¥10-20/月
- TDMQ：¥20-30/月
- SCF：¥50-100/月
- **总计**：¥200-270/月

**节省**：约¥100-150/月（使用混合云方案）

---

## 🔧 运维配置

### 数据备份

```bash
# 腾讯云：SQLite数据库
cat > /var/www/context-os/scripts/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/www/context-os/backups
mkdir -p $BACKUP_DIR
cp /var/www/context-os/data/context-os.db $BACKUP_DIR/context-os-$DATE.db
# 备份到COS
aws s3 cp $BACKUP_DIR/context-os-$DATE.db s3://context-os-backups/
EOF

chmod +x /var/www/context-os/scripts/backup.sh
crontab -e
# 每天凌晨2点备份
0 2 * * * /var/www/context-os/scripts/backup.sh
```

### 监控配置

在Coolify中可以配置：
- 服务健康检查
- 资源使用监控
- 自动重启策略

---

## ❗ 注意事项

### 1. 网络延迟
- 跨云访问会有延迟（20-100ms）
- 影响LLM调用速度
- 建议：ONEAPI和Redis尽量靠近用户

### 2. 安全性
- 使用内网IP（如果支持）
- 配置防火墙规则
- 启用SSL/TLS
- 定期更新密钥

### 3. 数据一致性
- 挂载存储可能有延迟
- 建议使用CFS而非rclone
- 文件上传后检查确认

### 4. 容灾备份
- 跨云部署提高可用性
- 定期备份到不同云
- 准备应急预案

---

## 🎯 后续优化

### 1. 迁移ONEAPI到腾讯云
如果跨云延迟影响体验，可以考虑：
```bash
# 在腾讯云服务器上用Docker部署ONEAPI
docker run -d --name one-api \
  -p 3001:3000 \
  -v /data/oneapi:/data \
  ghcr.io/songquanpeng/one-api:latest
```

### 2. 使用Redis缓存
在应用中集成Redis：
```typescript
// lib/redis.ts
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

await client.connect();

export { client as redisClient };
```

### 3. 添加CDN加速
为静态资源配置CDN：
- 腾讯云CDN
- 阿里云CDN
- Cloudflare

---

**下一步**：查看 [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) 了解代码迁移细节
