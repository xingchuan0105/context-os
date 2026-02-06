# 腾讯云配置快速参考

## 📦 需要购买的资源

### 1. 轻量应用服务器 A（前端）
- **规格**: 2C2G 50GB SSD
- **镜像**: Node.js 20 (CentOS 8.4)
- **地域**: 广州
- **价格**: ¥50/月
- **用途**: Next.js + SQLite

### 2. 轻量应用服务器 B（Qdrant）
- **规格**: 2C2G 50GB SSD
- **镜像**: Docker
- **地域**: 广州
- **价格**: ¥70/月
- **用途**: Qdrant向量数据库

### 3. 对象存储 COS
- **存储桶**: context-os-documents-{appid}
- **地域**: 广州 (ap-guangzhou)
- **权限**: 私有读写
- **价格**: ¥10-20/月 (50GB)

### 4. 消息队列 TDMQ
- **类型**: Pulsar 或 Kafka
- **Topic**: context-doc-process
- **价格**: ¥20-30/月

### 5. 云函数 SCF
- **运行时**: Node.js 20
- **内存**: 2048MB
- **超时**: 300秒
- **触发器**: TDMQ
- **价格**: ¥50-100/月（按量）

### 6. 域名 + SSL
- **域名**: 自定义
- **证书**: 免费证书（1年）
- **价格**: ¥10-50/月

**总成本**: ¥210-370/月

---

## 🔑 需要记录的关键信息

### 购买后立即记录

```bash
# 服务器A
公网IP: _______________
内网IP: _______________
SSH密码: _______________

# 服务器B (Qdrant)
公网IP: _______________
内网IP: _______________  # 重要！用于内网通信

# COS
SecretId: _______________
SecretKey: _______________
Bucket: _______________

# TDMQ
集群地址: _______________
用户名: _______________
密码: _______________

# 域名
域名: _______________
```

---

## 🚀 快速部署命令

### 方式1: 使用自动化脚本（推荐）

```bash
# 1. 登录服务器A
ssh root@<服务器A公网IP>

# 2. 下载脚本
wget https://your-repo/scripts/init-server.sh
chmod +x init-server.sh

# 3. 运行脚本
./init-server.sh

# 4. 按提示填写配置信息
```

### 方式2: 手动部署

```bash
# 1. 安装依赖
yum install -y git nginx
npm install -g pm2

# 2. 克隆代码
cd /var/www
git clone <your-repo> context-os
cd context-os
npm install

# 3. 配置环境变量
cp .env.example .env
vi .env  # 填写配置

# 4. 构建并启动
npm run build
pm2 start npm --name "context-os" -- start

# 5. 配置Nginx
vi /etc/nginx/conf.d/context-os.conf
nginx -t && systemctl restart nginx
```

---

## 🔧 Nginx配置模板

```nginx
# /etc/nginx/conf.d/context-os.conf

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

---

## 📝 环境变量模板

```bash
# .env 文件内容

DATABASE_URL=/var/www/context-os/data/context-os.db
JWT_SECRET=<随机32位字符串>

# 腾讯云COS
TENCENT_COS_SECRET_ID=<你的SecretId>
TENCENT_COS_SECRET_KEY=<你的SecretKey>
TENCENT_COS_BUCKET=context-os-documents-<appid>
TENCENT_COS_REGION=ap-guangzhou

# Qdrant（使用内网IP）
QDRANT_URL=http://<服务器B内网IP>:6333

# OneAPI/LLM
ONEAPI_BASE_URL=http://your-oneapi
ONEAPI_KEY=sk-xxx

# Embedding
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1

# TDMQ
TDMQ_BROKER=pulsar://xxx.tdmq.ap-guangzhou.tencenttdmq.com:6650
TDMQ_USERNAME=xxx
TDMQ_PASSWORD=xxx
TDMQ_TOPIC=context-doc-process

# SCF回调
CALLBACK_BASE_URL=https://yourdomain.com
```

---

## 🔐 安全组配置规则

### 服务器A（前端）

| 规则 | 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|------|
| 入站 | TCP | 80 | 0.0.0.0/0 | HTTP |
| 入站 | TCP | 443 | 0.0.0.0/0 | HTTPS |
| 入站 | TCP | 22 | 你的IP | SSH |
| 入站 | TCP | 3000 | 127.0.0.1 | 仅本地（PM2） |

### 服务器B（Qdrant）

| 规则 | 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|------|
| 入站 | TCP | 6333 | 服务器A内网IP | 仅内网 |
| 入站 | TCP | 22 | 你的IP | SSH管理 |

---

## 🧪 测试命令

```bash
# 1. 测试服务器A（前端）
curl http://localhost:3000

# 2. 测试Qdrant连接（从服务器A）
curl http://<服务器B内网IP>:6333/

# 3. 测试COS上传
# （通过Web界面测试）

# 4. 查看PM2日志
pm2 logs context-os

# 5. 查看Nginx日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 6. 测试SSL证书
curl https://yourdomain.com
```

---

## 📊 监控检查项

### 每日检查
- [ ] PM2进程状态: `pm2 status`
- [ ] 磁盘空间: `df -h`
- [ ] 数据库文件大小: `ls -lh data/context-os.db`

### 每周检查
- [ ] Qdrant存储: `du -sh /data/qdrant`
- [ ] COS存储用量
- [ ] TDMQ消息堆积
- [ ] SCF函数调用日志

### 每月检查
- [ ] 账单费用
- [ ] SSL证书有效期
- [ ] 备份文件完整性

---

## 🆘 故障排查

### 应用无法访问
```bash
# 1. 检查PM2进程
pm2 status
pm2 restart context-os

# 2. 检查Nginx
systemctl status nginx
nginx -t

# 3. 检查端口
netstat -tunlp | grep :3000
netstat -tunlp | grep :443
```

### Qdrant连接失败
```bash
# 1. 测试内网连接
ping <服务器B内网IP>
telnet <服务器B内网IP> 6333

# 2. 检查Qdrant状态
ssh root@<服务器B内网IP>
docker ps | grep qdrant
docker logs qdrant
```

### 文件上传失败
```bash
# 1. 检查COS配置
echo $TENCENT_COS_SECRET_ID
echo $TENCENT_COS_BUCKET

# 2. 测试CORS配置
# 在COS控制台检查权限设置
```

---

## 📞 获取帮助

- **详细文档**: `docs/TENCENT_CLOUD_SETUP.md`
- **迁移指南**: `MIGRATION_GUIDE.md`
- **PRD文档**: `PRD.md`
- **腾讯云工单**: 控制台 → 工单

---

**最后更新**: 2025-01-12
