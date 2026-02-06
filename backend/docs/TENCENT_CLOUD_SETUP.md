# 腾讯云从零配置完整方案

**目标成本**: ¥210-370/月
**预计时间**: 2-3小时

---

## 📋 目录

1. [账号注册与实名认证](#1-账号注册与实名认证)
2. [购买云资源](#2-购买云资源)
3. [配置对象存储 (COS)](#3-配置对象存储-cos)
4. [配置消息队列 (TDMQ)](#4-配置消息队列-tdmq)
5. [配置函数计算 (SCF)](#5-配置函数计算-scf)
6. [部署轻量应用服务器](#6-部署轻量应用服务器)
7. [配置域名和SSL](#7-配置域名和ssl)
8. [部署应用代码](#8-部署应用代码)
9. [测试验证](#9-测试验证)

---

## 1. 账号注册与实名认证

### 1.1 注册腾讯云账号

1. 访问 https://cloud.tencent.com/
2. 点击"免费注册"
3. 使用手机号注册
4. 完成实名认证（需要身份证）

### 1.2 开通服务

登录后依次开通以下服务：
- [ ] 轻量应用服务器 Lighthouse
- [ ] 对象存储 COS
- [ ] 消息队列 TDMQ
- [ ] 云函数 SCF

---

## 2. 购买云资源

### 2.1 购买轻量应用服务器 A（前端 + SQLite）

**规格**：
- CPU: 2核
- 内存: 2GB
- 存储: 50GB SSD
- 镜像: Node.js 18 或 Node.js 20
- 地域: 广州/上海/北京（建议广州，延迟低）
- 带宽: 4Mbps 或更高
- **价格**: ¥50/月

**购买步骤**：
1. 进入"产品" → "轻量应用服务器"
2. 点击"新建"
3. 选择配置：
   ```
   镜像: Node.js 20.11 (CentOS 8.4)
   套餐: 2核2GB 50GB SSD
   时长: 1个月/3个月/1年
   数量: 1台
   ```
4. 主机名: `context-os-frontend`
5. 点击"立即购买"
6. 等待创建完成（约3-5分钟）

**记录信息**：
```
公网IP: _______________
用户名: root
密码: _______________ (在控制台查看)
```

### 2.2 购买轻量应用服务器 B（Qdrant）

**规格**：
- CPU: 2核
- 内存: 2GB
- 存储: 50GB SSD
- 镜像: **Qdrant** (Docker镜像)
- 地域: 同上（建议同地域，内网互通）
- **价格**: ¥70/月

**购买步骤**：
1. 同上，镜像选择"Docker容器"
2. 主机名: `context-os-qdrant`
3. 购买后手动部署Qdrant（见第6步）

---

## 3. 配置对象存储 (COS)

### 3.1 创建存储桶

1. 进入"产品" → "对象存储"
2. 点击"创建存储桶"
3. 配置：
   ```
   存储桶名称: context-os-documents-{your-appid}
   所属地域: 广州 (ap-guangzhou)
   访问权限: 私有读写
   ```
4. 点击"创建"

### 3.2 获取访问密钥

1. 进入"访问管理" → "访问密钥" → "API密钥管理"
2. 点击"新建密钥"
3. 记录密钥信息：

```
SecretId: AKIDxxxxxxxxxxxxxxxx
SecretKey: xxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **重要**: 密钥只在创建时显示一次，请立即保存！

---

## 4. 配置消息队列 (TDMQ)

### 4.1 创建TDMQ实例

1. 进入"产品" → "TDMQ" → "pulsar" 或 "ckafka"
2. 点击"新建集群"
3. 配置：
   ```
   集群名称: context-os-queue
   地域: 广州
   版本: 2.7.1 (Pulsar) 或 2.4 (Kafka)
   专享集群: 选择小规格
   ```
4. 提交并等待创建（约5-10分钟）

### 4.2 创建Topic

1. 进入TDMQ集群
2. 创建命名空间: `context-os`
3. 创建Topic:
   ```
   名称: context-doc-process
   类型: 普通消息
   分区数: 3
   ```
4. 配置角色权限

### 4.3 获取连接信息

记录以下信息：
```
集群地址: pulsar://xxx.tdmq.ap-guangzhou.tencenttdmq.com:6650
HTTP接入地址: http://xxx.tdmq.ap-guangzhou.tencenttdmq.com:8080
用户名: context-os
密码: _______________
Topic: context-os/context-doc-process
```

---

## 5. 配置函数计算 (SCF)

### 5.1 创建函数

1. 进入"产品" → "云函数"
2. 点击"新建"
3. 选择"从头开始"或"使用自定义模板"
4. 基础配置：
   ```
   函数名称: document-processor
   运行环境: Node.js 20
   地域: 广州
   内存: 2048MB
   超时时间: 300秒
   ```

### 5.2 配置环境变量

在函数配置中添加环境变量：
```bash
TENCENT_COS_SECRET_ID=你的SecretId
TENCENT_COS_SECRET_KEY=你的SecretKey
TENCENT_COS_BUCKET=context-os-documents-{appid}
TENCENT_COS_REGION=ap-guangzhou
QDRANT_URL=http://内网IP:6333
ONEAPI_BASE_URL=http://your-oneapi
ONEAPI_KEY=sk-xxx
EMBEDDING_MODEL=BAAI/bge-m3
CALLBACK_BASE_URL=https://your-domain.com
```

### 5.3 配置TDMQ触发器

1. 进入函数 → "触发器管理"
2. 添加触发器：
   ```
   触发方式: TDMQ Pulsar触发器
   TDMQ集群: context-os-queue
   Topic: context-doc-process
   订阅: document-sub
   投递策略: 固定投递
   ```
3. 保存

### 5.4 上传函数代码

**方法1: 在线编辑**
- 复制 `functions/document-processor/index.ts` 内容
- 在线创建函数文件

**方法2: 本地上传**
```bash
cd functions/document-processor
zip -r function.zip ./*
# 在控制台上传function.zip
```

---

## 6. 部署轻量应用服务器

### 6.1 登录服务器A（前端）

```bash
# SSH登录（Windows使用PowerShell或Git Bash）
ssh root@<公网IP>

# 或使用腾讯云控制台的"登录"按钮（VNC或WebShell）
```

### 6.2 安装Node.js（如果镜像未包含）

```bash
# 检查版本
node -v
npm -v

# 如果未安装
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs
```

### 6.3 安装PM2（进程管理）

```bash
npm install -g pm2
pm2 --version
```

### 6.4 部署Qdrant到服务器B

```bash
# 登录服务器B
ssh root@<Qdrant服务器IP>

# 安装Docker（如果没有）
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

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

⚠️ **安全配置**：
```bash
# 配置防火墙（只允许内网访问）
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.0/8" port port="6333" protocol="tcp" accept'
firewall-cmd --reload
```

**获取Qdrant内网地址**：
```bash
# 在服务器A上测试连接
curl http://<Qdrant服务器内网IP>:6333/
```

---

## 7. 配置域名和SSL

### 7.1 购买域名

1. 腾讯云"域名注册"
2. 搜索并购买域名（如 `contextos.com`）
3. 完成实名认证和备案（中国大陆需要）

### 7.2 配置DNS解析

1. 进入"DNS解析"
2. 添加记录：
   ```
   主机记录: @
   记录类型: A
   记录值: <服务器A公网IP>
   TTL: 600
   ```

### 7.3 配置SSL证书

**免费证书**：
1. 进入"SSL证书"
2. 申请"免费证书"（Cloudflare Origin）
3. 域名验证：DNS验证
4. 下载证书（Nginx格式）

**安装证书**：
```bash
# 在服务器A上
mkdir -p /etc/nginx/ssl
# 上传证书文件到该目录
# - 1_yourdomain.com_bundle.crt
# - 2_yourdomain.com.key
```

### 7.4 配置Nginx

```bash
# 安装Nginx
yum install -y nginx

# 创建配置文件
vi /etc/nginx/conf.d/context-os.conf
```

Nginx配置内容：
```nginx
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
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# 启动Nginx
nginx -t
systemctl start nginx
systemctl enable nginx
```

---

## 8. 部署应用代码

### 8.1 克隆代码

```bash
# 在服务器A上
cd /var/www
git clone <your-repo-url> context-os
cd context-os
```

或使用SCP上传：
```bash
# 本地执行
scp -r context-os root@<IP>:/var/www/
```

### 8.2 安装依赖

```bash
cd /var/www/context-os
npm install
```

### 8.3 配置环境变量

```bash
# 创建.env文件
vi .env
```

粘贴以下内容（填写实际值）：
```bash
DATABASE_URL=/var/www/context-os/data/context-os.db
JWT_SECRET=<随机字符串，至少32位>

TENCENT_COS_SECRET_ID=<你的SecretId>
TENCENT_COS_SECRET_KEY=<你的SecretKey>
TENCENT_COS_BUCKET=context-os-documents-<appid>
TENCENT_COS_REGION=ap-guangzhou

QDRANT_URL=http://<Qdrant服务器内网IP>:6333

ONEAPI_BASE_URL=http://your-oneapi
ONEAPI_KEY=sk-xxx

EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1

TDMQ_BROKER=pulsar://xxx.tdmq.ap-guangzhou.tencenttdmq.com:6650
TDMQ_USERNAME=context-os
TDMQ_PASSWORD=<你的密码>
TDMQ_TOPIC=context-doc-process

CALLBACK_BASE_URL=https://yourdomain.com
```

生成JWT密钥：
```bash
# 生成随机密钥
openssl rand -base64 32
```

### 8.4 创建数据目录

```bash
mkdir -p /var/www/context-os/data
chmod 755 /var/www/context-os/data
```

### 8.5 构建应用

```bash
npm run build
```

### 8.6 启动应用

```bash
# 使用PM2启动
pm2 start npm --name "context-os" -- start

# 保存PM2配置
pm2 save
pm2 startup

# 查看日志
pm2 logs context-os
```

---

## 9. 测试验证

### 9.1 基础功能测试

```bash
# 1. 测试服务健康
curl https://yourdomain.com

# 2. 测试注册
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}'

# 3. 测试登录
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}'
```

### 9.2 文件上传测试

1. 访问 `https://yourdomain.com`
2. 注册/登录账号
3. 创建知识库
4. 上传测试文档
5. 检查COS存储桶确认文件上传成功
6. 检查SCF日志确认处理触发

### 9.3 搜索功能测试

```bash
# 测试搜索API（需要先登录获取Cookie）
curl -X POST https://yourdomain.com/api/search \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=<your_token>" \
  -d '{"query":"测试查询","mode":"drill-down"}'
```

---

## 🔧 运维配置

### 日志管理

```bash
# PM2日志
pm2 logs

# Nginx日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 应用日志（如果配置了文件日志）
```

### 数据库备份

```bash
# 创建备份脚本
vi /var/www/context-os/scripts/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/www/context-os/backups
mkdir -p $BACKUP_DIR
cp /var/www/context-os/data/context-os.db $BACKUP_DIR/context-os-$DATE.db
# 删除7天前的备份
find $BACKUP_DIR -name "context-os-*.db" -mtime +7 -delete
```

```bash
# 添加定时任务
crontab -e
# 每天凌晨2点备份
0 2 * * * /var/www/context-os/scripts/backup.sh
```

### 监控告警

在腾讯云"云监控"中配置：
- CPU使用率告警（>80%）
- 内存使用率告警（>85%）
- 磁盘使用率告警（>90%）
- 服务异常告警

---

## 📊 成本汇总

| 资源 | 规格 | 月成本 | 年成本 |
|------|------|--------|--------|
| 轻量服务器A | 2C2G 50GB | ¥50 | ¥500 |
| 轻量服务器B | 2C2G 50GB (Qdrant) | ¥70 | ¥700 |
| COS存储 | 50GB | ¥10-20 | ¥120-240 |
| TDMQ | 小规格 | ¥20-30 | ¥240-360 |
| SCF | 按量付费 | ¥50-100 | ¥600-1200 |
| 域名+SSL | .com | ¥10-50 | ¥120-600 |
| **总计** | | **¥210-370** | **¥2280-3600** |

**省钱技巧**：
- 购买年付可享受8-9折优惠
- 新用户有代金券（可抵扣¥100-500）
- 学生认证可享受优惠

---

## ❗ 常见问题

### Q1: 端口无法访问？
A: Use Cloudflare Origin Certificate and place it on the server:
```bash
sudo mkdir -p /etc/nginx/ssl
sudo tee /etc/nginx/ssl/yourdomain.com.pem > /dev/null <<'EOF'
... your certificate ...
EOF
sudo tee /etc/nginx/ssl/yourdomain.com.key > /dev/null <<'EOF'
... your private key ...
EOF
sudo chmod 600 /etc/nginx/ssl/yourdomain.com.key
```

---

## 📞 技术支持

- 腾讯云文档: https://cloud.tencent.com/document/product
- 工单系统: 腾讯云控制台 → 工单
- 技术社区: https://cloud.tencent.com/developer

---

**下一步**: 查看 `MIGRATION_GUIDE.md` 了解迁移细节
