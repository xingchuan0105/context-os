# OneAPI 安装与配置指南

本文档指导你完成 OneAPI 的安装、配置和渠道设置，为 Context OS 提供统一的 LLM 网关。

---

## 目录

1. [什么是 OneAPI](#什么是-oneapi)
2. [安装方式选择](#安装方式选择)
3. [方式一：Docker 安装（推荐）](#方式一docker-安装推荐)
4. [方式二：Docker Compose 安装](#方式二docker-compose-安装)
5. [初始化配置](#初始化配置)
6. [添加模型渠道](#添加模型渠道)
7. [创建 API 令牌](#创建-api-令牌)
8. [验证配置](#验证配置)
9. [常见问题](#常见问题)

---

## 什么是 OneAPI

**OneAPI** 是一个开源的 LLM 网关，支持聚合多个模型供应商（OpenAI、DeepSeek、Claude 等），提供：

- **统一接口**: 所有模型通过一个 OpenAI 兼容的 API 调用
- **多渠道负载均衡**: 自动分配请求到不同渠道，解决单供应商限流问题
- **故障转移**: 某个渠道失败时自动切换到备用渠道
- **令牌管理**: 为不同应用创建独立的 API 密钥

GitHub: https://github.com/songquanpeng/one-api

---

## 安装方式选择

| 方式 | 适用场景 | 难度 | 推荐度 |
|------|---------|------|--------|
| Docker 单命令 | 快速测试、本地开发 | 简单 | ⭐⭐⭐⭐ |
| Docker Compose | 生产环境、需要数据持久化 | 中��� | ⭐⭐⭐⭐⭐ |
| 源码编译 | 需要自定义功能 | 复杂 | ⭐⭐ |

---

## 方式一：Docker 安装（推荐）

### 1. 拉取镜像

```bash
docker pull justsong/one-api:latest
```

### 2. 启动容器

```bash
docker run -d \
  --name one-api \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v /path/to/data:/data \
  justsong/one-api:latest
```

**参数说明**:
- `-p 3000:3000`: 映射端口到主机 3000
- `-v /path/to/data:/data`: 数据持久化目录（Windows 改为 `C:\oneapi\data`）
- `-e TZ=Asia/Shanghai`: 设置时区

**Windows 示例**:
```powershell
docker run -d `
  --name one-api `
  -p 3000:3000 `
  -v C:\oneapi\data:/data `
  justsong/one-api:latest
```

### 3. 访问管理界面

打开浏览器访问: http://localhost:3000

---

## 方式二：Docker Compose 安装

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  one-api:
    image: justsong/one-api:latest
    container_name: one-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - TZ=Asia/Shanghai
      # MySQL 数据库配置（可选，默认使用 SQLite）
      # - SQL_DSN=root:123456@tcp(localhost:3306)/oneapi
    volumes:
      - ./data:/data
    networks:
      - one-api-network

networks:
  one-api-network:
    driver: bridge
```

启动服务：

```bash
docker-compose up -d
```

---

## 初始化配置

### 1. 首次登录

访问 http://localhost:3000，使用默认管理员账号登录：

```
用户名: root
密码: 123456
```

**⚠️ 重要**: 登录后立即修改密码！

### 2. 修改管理员密码

1. 点击右上角头像 -> **个人设置**
2. 输入新密码并保存

---

## 添加模型渠道

OneAPI 支持多种模型供应商，以下是常用渠道配置：

### DeepSeek (硅基流动)

1. 进入 **渠道** -> **令牌** (新版为 **渠道** 页面)
2. 点击 **创建令牌** 或 **添加渠道**
3. 填写配置：

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `DeepSeek-硅基流动` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://api.siliconflow.cn/v1` |
| 密钥 | `sk-xxxxxxxx` (从硅基流动获取) |
| 模型映射 | `deepseek-chat` |

### DeepSeek (官方)

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `DeepSeek-官方` |
| 渠道类型 | `DeepSeek` |
| Base URL | `https://api.deepseek.com` |
| 密钥 | `sk-xxxxxxxx` (从 DeepSeek 获取) |
| 模型映射 | `deepseek-chat` |

### 阿里云百炼

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `阿里云百炼` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 密钥 | `sk-xxxxxxxx` |
| 模型映射 | `qwen-plus`, `qwen-turbo` |

### 火山引擎 (字节跳动)

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `火山引擎` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://ark.cn-beijing.volces.com/api/v3` |
| 密钥 | `xxxxxxxx` |
| 模型映射 | `doubao-pro-32k` |

### OpenAI 官方

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `OpenAI` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://api.openai.com/v1` |
| 密钥 | `sk-xxxxxxxx` |
| 模型映射 | `gpt-4o`, `gpt-4o-mini` |

---

## 创建 API 令牌

### 1. 创建令牌

1. 进入 **令牌** (Tokens) 页面
2. 点击 **创建令牌**
3. 配置令牌：

| 配置项 | 值 |
|--------|-----|
| 令牌名称 | `Context OS` |
| 额度 | 推荐设置为 `500000` (50万 tokens) |
| 过期时间 | 可选设置 |
| 模型权限 | 选择需要暴露的模型 |

### 2. 复制密钥

创建后会显示一串以 `sk-` 开头的密钥，**立即复制保存**，关闭后无法再次查看。

### 3. 配置到 Context OS

在项目根目录的 `.env.local` 文件中添加：

```bash
ONEAPI_BASE_URL=http://localhost:3000/v1
ONEAPI_API_KEY=sk-刚才复制的密钥
ONEAPI_MODEL=deepseek-chat
```

---

## 验证配置

### 1. 测试 OneAPI 连接

```bash
curl http://localhost:3000/api/status
```

### 2. 测试模型调用

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-你的密钥" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 3. 运行 Context OS Worker

```bash
npm run worker
```

观察 Worker 日志，确认能正常连接 OneAPI。

---

## 常见问题

### Q1: Docker 容器启动失败

**检查端口占用**:
```bash
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000
```

更换端口或关闭占用进程。

### Q2: 模型调用返回 401 错误

- 检查 API 密钥是否正确
- 确认令牌未过期
- 检查令牌是否有该模型的使用权限

### Q3: 渠道总是报错

- 检查 Base URL 是否正确（注意 `/v1` 后缀）
- 确认上游 API 密钥有效且有余额
- 查看 OneAPI 日志获取详细错误信息

### Q4: 如何实现负载均衡？

OneAPI 会自动在所有启用的渠道间分配请求。建议：

1. 添加多个相同模型的渠道（如 3 个 DeepSeek 渠道）
2. 为每个渠道设置不同的权重（优先级）
3. 设置渠道的 `最大并发数` 防止单渠道过载

### Q5: 生产环境部署建议

1. **使用域名**: 配置 Nginx 反向代理，启用 HTTPS
2. **数据库**: 从 SQLite 迁移到 MySQL/PostgreSQL
3. **备份**: 定期备份 `/data` 目录
4. **监控**: 配置 Prometheus + Grafana 监控调用统计

---

## 下一步

配置完成后，继续阅读：
- [Supabase 数据库配置](./SUPABASE_SETUP.md)
- [Redis 部署指南](./REDIS_SETUP.md)
