# Context-OS 腾讯云部署指南

**部署方式**: 直接部署到轻量应用服务器
**预计时间**: 1-2小时
**难度**: 中等

---

## 📋 部署前准备

### 资源清单确认

在开始部署前，请确保已购买以下资源：

- [ ] 轻量应用服务器A（Node.js 20）
- [ ] 轻量应用服务器B（Docker）
- [ ] COS对象存储（已创建存储桶）
- [ ] TDMQ消息队列（已创建集群和Topic）
- [ ] 域名（可选，用于HTTPS访问）

### 需要准备的配置信息

请提前准备好以下信息：

```
【服务器A】
公网IP: _______________
内网IP: _______________

【服务器B】
公网IP: _______________
内网IP: _______________

【腾讯云COS】
SecretId: _________________________________
SecretKey: _________________________________
Bucket名称: _________________________________
Region: ap-guangzhou

【TDMQ】
Broker地址: _________________________________
用户名: _________________________________
密码: _________________________________

【OneAPI/LLM】
Base URL: _________________________________
API Key: _________________________________

【域名】（如果有）
域名: _________________________________
```

---

## 🚀 部署步骤

### 第一步：部署服务器B（Qdrant向量数据库）

#### 1.1 SSH登录服务器B

```bash
ssh root@<服务器B公网IP>
```

或使用腾讯云控制台的"登录"按钮。

#### 1.2 上传并执行部署脚本

**方式1: 使用wget下载（推荐）**

```bash
# 下载部署脚本
wget https://raw.githubusercontent.com/your-repo/context-os/main/scripts/deploy-server-b.sh

# 添加执行权限
chmod +x deploy-server-b.sh

# 执行部署
./deploy-server-b.sh
```

**方式2: 手动创建脚本**

```bash
# 创建脚本文件
vi deploy-server-b.sh
# 复制 scripts/deploy-server-b.sh 的内容
# 保存并退出

# 执行部署
chmod +x deploy-server-b.sh
./deploy-server-b.sh
```

#### 1.3 记录内网IP

部署完成后，记录服务器B的内网IP：

```bash
ip addr show eth0
```

记下 `inet` 地址（如：`10.0.4.5`），后面配置服务器A时需要用到。

#### 1.4 验证Qdrant运行

```bash
# 测试本地访问
curl http://localhost:6333/

# 查看容器状态
docker ps

# 查看日志
docker logs qdrant
```

---

### 第二步：部署服务器A（Next.js应用）

#### 2.1 SSH登录服务器A

```bash
ssh root@<服务器A公网IP>
```

#### 2.2 上传部署脚本

**方式1: 使用wget（推荐）**

```bash
wget https://raw.githubusercontent.com/your-repo/context-os/main/scripts/deploy-server-a.sh
chmod +x deploy-server-a.sh
```

**方式2: 手动创建**

```bash
vi deploy-server-a.sh
# 复制 scripts/deploy-server-a.sh 的内容
```

#### 2.3 上传应用代码

**方式1: Git克隆（推荐）**

```bash
cd /var/www
git clone <你的仓库地址> context-os
```

**方式2: SCP上传（从本地执行）**

```bash
# 在本地电脑执行
scp -r context-os root@<服务器A公网IP>:/var/www/
```

#### 2.4 执行部署脚本

```bash
cd /root
./deploy-server-a.sh
```

脚本会自动：
- 更新系统
- 检查/安装Node.js 20
- 安装PM2进程管理器
- 安装Nginx
- 创建应用目录
- 安装依赖
- 构建Next.js应用

#### 2.5 配置环境变量

**方式1: 使用交互式配置脚本**

```bash
cd /var/www/context-os/scripts
chmod +x setup-env.sh
./setup-env.sh
```

按提示输入各项配置信息。

**方式2: 手动编辑**

```bash
vi /var/www/context-os/.env
```

填写以下关键配置：

```bash
# 数据库
DATABASE_URL=/var/www/context-os/data/context-os.db

# JWT（使用脚本生成的密钥）
JWT_SECRET=<生成的密钥>

# COS配置
TENCENT_COS_SECRET_ID=<你的SecretId>
TENCENT_COS_SECRET_KEY=<你的SecretKey>
TENCENT_COS_BUCKET=<你的Bucket名称>
TENCENT_COS_REGION=ap-guangzhou

# Qdrant（使用服务器B的内网IP！）
QDRANT_URL=http://<服务器B内网IP>:6333

# OneAPI
ONEAPI_BASE_URL=<你的OneAPI地址>
ONEAPI_KEY=<你的API Key>

# Embedding
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_API_KEY=<同ONEAPI_KEY>
EMBEDDING_BASE_URL=<你的Embedding API地址>

# TDMQ
TDMQ_BROKER=<你的TDMQ Broker地址>
TDMQ_USERNAME=<用户名>
TDMQ_PASSWORD=<密码>
TDMQ_TOPIC=context-doc-process

# 回调URL
CALLBACK_BASE_URL=https://<你的域名>
```

#### 2.6 重新构建和启动

```bash
cd /var/www/context-os

# 重新构建
npm run build

# 重启应用
pm2 restart context-os

# 查看日志
pm2 logs context-os
```

---

### 第三步：配置Nginx和SSL

#### 3.1 创建Nginx配置文件

```bash
vi /etc/nginx/conf.d/context-os.conf
```

复制 `scripts/nginx-context-os.conf` 的内容，并替换以下内容：

- `yourdomain.com` → 你的域名
- 如果没有域名，先使用IP访问，跳过SSL配置

#### 3.2 配置SSL证书（如果有域名）

**方式1: 使用Let's Encrypt免费证书**

```bash
# 安装Certbot
yum install -y certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 会自动配置Nginx，非常方便
```

**方式2: 使用腾讯云免费证书**

1. 在腾讯云控制台申请免费SSL证书
2. 下载证书（Nginx格式）
3. 上传证书文件到服务器：

```bash
mkdir -p /etc/nginx/ssl

# 上传证书文件
# - 1_yourdomain.com_bundle.crt
# - 2_yourdomain.com.key
```

4. 修改Nginx配置文件中的证书路径

#### 3.3 测试并启动Nginx

```bash
# 测试配置
nginx -t

# 启动Nginx
systemctl start nginx
systemctl enable nginx

# 如果已有Nginx运行
systemctl restart nginx
```

#### 3.4 配置防火墙

```bash
# 开放HTTP和HTTPS端口
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

同时在腾讯云控制台配置安全组，开放端口：
- 80（HTTP）
- 443（HTTPS）

---

### 第四步：配置腾讯云SCF云函数（可选）

云函数用于异步处理文档，如果不需要异步处理可跳过。

#### 4.1 创建云函数

1. 登录腾讯云SCF控制台
2. 新建函数 → 从头开始
3. 函数名称: `document-processor`
4. 运行环境: Node.js 20
5. 内存: 2048MB
6. 超时: 300秒

#### 4.2 配置环境变量

复制服务器A的 `.env` 配置到SCF函数环境变量中。

#### 4.3 配置TDMQ触发器

1. 进入函数 → 触发器管理
2. 添加触发器 → TDMQ触发器
3. 选择你的TDMQ集群和Topic

---

### 第五步：测试验证

#### 5.1 基础服务检查

```bash
# 1. 检查Next.js应用
curl http://localhost:3000

# 2. 检查PM2进程
pm2 list

# 3. 检查Nginx
systemctl status nginx
```

#### 5.2 访问测试

1. 打开浏览器访问：`https://yourdomain.com` 或 `http://服务器IP`
2. 应该看到Context-OS登录页面

#### 5.3 功能测试

1. **注册账号**
   - 点击注册
   - 填写邮箱和密码
   - 提交注册

2. **登录系统**
   - 使用注册的账号登录

3. **创建知识库**
   - 点击"创建知识库"
   - 输入知识库名称
   - 提交

4. **上传文档**
   - 选择知识库
   - 上传测试PDF文件
   - 检查上传状态

5. **验证COS存储**
   - 登录腾讯云COS控制台
   - 进入你的存储桶
   - 应该看到上传的文件

#### 5.4 日志排查

如果遇到问题，查看日志：

```bash
# 应用日志
pm2 logs context-os

# Nginx访问日志
tail -f /var/log/nginx/context-os-access.log

# Nginx错误日志
tail -f /var/log/nginx/context-os-error.log

# 系统日志
journalctl -xe
```

---

## 🔧 常见问题排查

### 问题1: 无法访问网站

**检查项**:
```bash
# 1. 检查应用是否运行
pm2 list

# 2. 检查端口是否监听
netstat -tlnp | grep 3000

# 3. 检查Nginx配置
nginx -t

# 4. 检查防火墙
firewall-cmd --list-all

# 5. 检查腾讯云安全组
# 登录腾讯云控制台 → 轻量应用服务器 → 防火墙
```

### 问题2: 文件上传失败

**检查项**:
```bash
# 1. 检查COS配置
cat /var/www/context-os/.env | grep COS

# 2. 检查应用日志
pm2 logs context-os --lines 50

# 3. 测试COS连接
# 在应用日志中搜索 "COS" 或 "SignatureDoesNotMatch"
```

**解决方法**:
- 确认COS密钥正确
- 确认CORS配置正确
- 确认Bucket名称和地域正确

### 问题3: 无法连接到Qdrant

**检查项**:
```bash
# 在服务器A上测试连接
curl http://<服务器B内网IP>:6333/
```

**解决方法**:
- 确认使用的是**内网IP**，不是公网IP
- 确认两台服务器在同一地域
- 检查服务器B防火墙是否开放6333端口

### 问题4: SSL证书错误

**检查项**:
```bash
# 检查证书文件
ls -la /etc/nginx/ssl/

# 检查证书有效期
openssl x509 -in /etc/nginx/ssl/1_yourdomain.com_bundle.crt -noout -dates
```

**解决方法**:
- 确认证书文件路径正确
- 确认域名匹配
- 使用Let's Encrypt自动续期

---

## 📊 运维管理

### 查看应用状态

```bash
# PM2进程状态
pm2 list

# 实时日志
pm2 logs context-os

# 监控面板
pm2 monit
```

### 重启应用

```bash
# 重启应用
pm2 restart context-os

# 重载Nginx
nginx -s reload

# 或
systemctl reload nginx
```

### 数据备份

```bash
# 创建备份脚本
vi /var/www/context-os/scripts/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/www/context-os/backups
mkdir -p $BACKUP_DIR

# 备份数据库
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

### 更新应用

```bash
cd /var/www/context-os

# 拉取最新代码
git pull

# 安装新依赖
npm install

# 重新构建
npm run build

# 重启应用
pm2 restart context-os
```

---

## 🎯 下一步

部署完成后，你可以：

1. **配置监控告警**
   - 腾讯云云监控
   - 配置CPU、内存、磁盘告警

2. **配置域名解析**
   - 在域名注册商处添加A记录
   - 指向服务器A的公网IP

3. **性能优化**
   - 配置CDN加速
   - 启用Gzip压缩
   - 优化Nginx缓存

4. **安全加固**
   - 定期更新系统
   - 配置fail2ban防止暴力破解
   - 定期备份

---

## 📞 获取帮助

- 项目文档: `docs/` 目录
- 腾讯云文档: https://cloud.tencent.com/document/product
- 工单系统: 腾讯云控制台 → 工单

---

**部署完成后，请运行以下命令验证所有服务：**

```bash
# 健康检查脚本
curl -f https://yourdomain.com/health || echo "应用异常"
pm2 list
systemctl status nginx
docker ps  # 在服务器B上
```

祝部署顺利！🎉
