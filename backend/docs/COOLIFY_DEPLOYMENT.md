# 在Coolify中部署ONEAPI和Redis

## 🎯 目标

在阿里云ECS服务器上使用Coolify部署：
- **ONEAPI**：LLM统一网关
- **Redis**：缓存和会话存储

---

## 📋 前提条件

- 阿里云ECS服务器已安装Coolify
- 服务器已安装Docker
- 有服务器root权限

---

## 🚀 第一步：访问Coolify

### 1.1 登录Coolify

```bash
# 如果在本地安装
访问: http://<服务器IP>:8000

# 如果使用域名
访问: https://coolify.yourdomain.com
```

### 1.2 初始化设置

首次访问时：
1. 设置管理员账号
2. 配置服务器（如果还没添加）
3. 选择项目创建方式

---

## 🔧 第二步：部署ONEAPI

### 方法1: 使用Docker Compose（推荐）

#### 2.1 创建新项目

在Coolify控制台：
1. 点击 "New Project" → "Docker Compose"
2. 项目名称：`one-api`
3. 选择服务器

#### 2.2 配置Docker Compose

粘贴以下配置：

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
      - SQL_DSN=root:oneapi123@tcp(oneapi-db:3306)/one-api
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
      - MYSQL_ROOT_PASSWORD=oneapi123
      - MYSQL_DATABASE=one-api
      - MYSQL_USER=oneapi
      - MYSQL_PASSWORD=oneapi123
    volumes:
      - /data/oneapi-db:/var/lib/mysql
    networks:
      - oneapi-network

networks:
  oneapi-network:
    driver: bridge
```

#### 2.3 部署

1. 点击 "Deploy"
2. 等待镜像拉取和容器启动
3. 查看日志确认启动成功

#### 2.4 访问ONEAPI

```bash
# 访问地址
http://<服务器IP>:3001

# 或使用配置的域名
https://oneapi.yourdomain.com
```

#### 2.5 初始化ONEAPI

首次访问：
1. 默认管理员账号：查看日志获取初始密码
```bash
# 在Coolify中查看one-api容器日志
# 或在服务器上
docker logs one-api
```

2. 修改默认密码
3. 添加API渠道：
   - OpenAI
   - DeepSeek
   - 通义千问
   - 智谱AI
   - 等等

#### 2.6 创建API Token

1. 登录ONEAPI后台
2. 进入"令牌"页面
3. 点击"新建令牌"
4. 记录Token（sk-xxxx）

**记录配置信息**：
```
ONEAPI_BASE_URL=http://<服务器IP>:3001
ONEAPI_KEY=sk-xxxx (刚创建的token)
```

### 方法2: 使用预构建镜像

#### 2.1 创建项目

1. "New Project" → "Git Repository"
2. 输入ONEAPI的GitHub仓库：
   ```
   https://github.com/songquanpeng/one-api
   ```

#### 2.2 配置构建设置

```
Build Path: /
Dockerfile: Dockerfile (如果存在)
Port: 3000
Environment Variables:
  - SQL_DSN=root:password@tcp(db:3306)/one-api
```

#### 2.3 添加数据库服务

在同一项目中添加第二个服务：
- 类型：Docker
- 镜像：`mysql:8.0`
- 环境变量：
  - MYSQL_ROOT_PASSWORD=password
  - MYSQL_DATABASE=one-api

---

## 🔴 第三步：部署Redis

### 方法1: 使用官方镜像（推荐）

#### 3.1 创建新项目

1. "New Project" → "Docker"
2. 项目名称：`redis`

#### 3.2 配置Redis

**基本信息**：
```
Name: redis
Docker Image: redis:7-alpine
Port Mapping: 6379:6379
```

**Volumes**（数据持久化）：
```
Container Path: /data
Host Path: /data/redis
```

**Environment Variables**：
```
- REDIS_PASSWORD=your_secure_password (可选)
```

**Command**（如果有密码）：
```
redis-server --requirepass your_secure_password --appendonly yes
```

或无密码：
```
redis-server --appendonly yes
```

#### 3.3 部署

1. 点击 "Deploy"
2. 等待Redis启动
3. 测试连接

### 方法2: 使用Redis Commander（带管理界面）

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
    networks:
      - redis-network

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: redis-commander
    restart: always
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    networks:
      - redis-network
    depends_on:
      - redis

networks:
  redis-network:
    driver: bridge
```

访问管理界面：`http://<服务器IP>:8081`

### 方法3: 配置持久化

创建 `redis.conf` 文件：

```ini
# 网络配置
bind 0.0.0.0
port 6379
protected-mode no

# 持久化
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000

# 内存管理
maxmemory 256mb
maxmemory-policy allkeys-lru

# 日志
loglevel notice
logfile /data/redis.log
```

在Coolify中挂载配置文件：
```
Config File: /etc/redis/redis.conf
Host Path: /data/redis/redis.conf
Command: redis-server /etc/redis/redis.conf
```

---

## 🔐 第四步：配置安全

### 4.1 配置防火墙

在阿里云控制台：

**安全组规则**：

| 规则 | 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|------|
| 入站 | TCP | 3001 | 腾讯云服务器IP | ONEAPI |
| 入站 | TCP | 6379 | 腾讯云服务器IP | Redis |
| 入站 | TCP | 8000 | 你的IP | Coolify |
| 入站 | TCP | 22 | 你的IP | SSH |

⚠️ **重要**：不要开放3001和6379到公网！

### 4.2 配置反向代理（可选）

如果需要通过域名访问：

**ONEAPI**：
```nginx
server {
    listen 80;
    server_name oneapi.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name oneapi.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

**Redis Commander**（如果使用）：
```nginx
location /redis/ {
    proxy_pass http://localhost:8081/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    auth_basic "Redis Commander";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

---

## ✅ 第五步：验证部署

### 测试ONEAPI

```bash
# 从腾讯云服务器测试
curl http://<阿里云IP>:3001

# 应该返回ONEAPI的HTML页面

# 测试API
curl http://<阿里云IP>:3001/v1/models \
  -H "Authorization: Bearer sk-xxxx"
```

### 测试Redis

```bash
# 从腾讯云服务器测试（如果有密码）
redis-cli -h <阿里云IP> -p 6379 -a your_password ping

# 应该返回 PONG

# 测试写入
redis-cli -h <阿里云IP> -p 6379 -a your_password SET test "hello"

# 测试读取
redis-cli -h <阿里云IP> -p 6379 -a your_password GET test
```

### 测试网络连通性

```bash
# 在腾讯云服务器上
ping <阿里云IP>

# 测试端口
telnet <阿里云IP> 3001
telnet <阿里云IP> 6379

# 测试HTTP
curl -I http://<阿里云IP>:3001
```

---

## 🔧 第六步：集成到Context OS

### 更新环境变量

在腾讯云服务器的 `.env` 文件中：

```bash
# ONEAPI（阿里云）
ONEAPI_BASE_URL=http://<阿里云公网IP>:3001
ONEAPI_KEY=sk-xxxx (在ONEAPI中创建的token)

# Embedding（使用ONEAPI）
EMBEDDING_API_KEY=sk-xxxx (同上)
EMBEDDING_BASE_URL=http://<阿里云公网IP>:3001

# Redis（阿里云）
REDIS_HOST=<阿里云公网IP>
REDIS_PORT=6379
REDIS_PASSWORD=your_password (如果有)
REDIS_URL=redis://:your_password@<阿里云公网IP>:6379
```

### 重启应用

```bash
pm2 restart context-os
pm2 logs context-os
```

---

## 📊 第七步：监控和管理

### 在Coolify中查看状态

1. 进入项目列表
2. 查看每个项目的：
   - CPU使用率
   - 内存使用
   - 磁盘使用
   - 网络流量

### 配置自动重启

在项目设置中：
```
Restart Policy: always
Auto Restart: on failure
Health Check: enabled
```

### 备份数据

**ONEAPI数据**：
```bash
# 备份MySQL
docker exec oneapi-db mysqldump -uroot -poneapi123 one-api > backup.sql

# 或使用Cron定时备份
0 2 * * * docker exec oneapi-db mysqldump -uroot -poneapi123 one-api > /backup/oneapi-$(date +\%Y\%m\%d).sql
```

**Redis数据**：
```bash
# Redis开启AOF，自动持久化到/data
# 定期备份/data目录
tar -czf redis-backup-$(date +%Y%m%d).tar.gz /data/redis
```

---

## ❗ 常见问题

### 1. ONEAPI无法启动

**检查日志**：
```bash
docker logs one-api
```

**常见原因**：
- 数据库连接失败 → 检查MySQL容器状态
- 端口冲突 → 修改端口映射
- 权限问题 → 检查/data目录权限

### 2. Redis连接失败

**测试连接**：
```bash
# 进入Redis容器
docker exec -it redis redis-cli

# 或从外部
redis-cli -h <服务器IP> -p 6379
```

**检查配置**：
- 端口是否正确
- 密码是否匹配
- 防火墙是否开放

### 3. 跨云延迟高

**测试延迟**：
```bash
# 从腾讯云服务器
ping <阿里云IP>
curl -w "@curl-format.txt" http://<阿里云IP>:3001
```

**优化方案**：
- 使用更近的地域
- 启用压缩
- 考虑将服务迁移到同一云

### 4. 容器重启后数据丢失

**检查数据卷**：
```bash
docker inspect one-api | grep -A 10 Mounts
```

确保volume正确挂载到宿主机目录。

---

## 🎯 下一步

部署完成后：

1. ✅ 在ONEAPI中添加你的LLM渠道
2. ✅ 配置API Token
3. ✅ 在腾讯云服务器上更新环境变量
4. ✅ 测试Context OS的搜索功能
5. ✅ 配置监控和告警

---

## 📞 获取帮助

- **ONEAPI文档**: https://github.com/songquanpeng/one-api
- **Redis文档**: https://redis.io/documentation
- **Coolify文档**: https://coolify.io/docs
- **Discord社区**: https://discord.gg/coolify

---

**最后更新**: 2025-01-12


### ?????????Coolify Secrets?

????????????? **Coolify Project/Service -> Environment Variables -> Secrets**?
??? `.env` ??????

?????`docs/PRODUCTION_ENV_TEMPLATE.md`?
