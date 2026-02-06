# Docker 快速启动指南

## 服务状态

✅ **ONEAPI** 已启动：http://localhost:3000
⏳ **Qdrant** 正在启动：http://localhost:6333

---

## 快速配置 ONEAPI（5 分钟）

### 步骤 1: 访问 ONEAPI 管理后台

浏览器打开：http://localhost:3000

**默认登录信息**：
- 用户名：`admin`
- 密码：`admin123`

⚠️ 首次登录后系统会提示修改密码

---

### 步骤 2: 创建 API 令牌

1. 登录后，点击左侧菜单 **"令牌"**
2. 点击 **"新建令牌"**
3. 配置令牌：
   ```
   名称: Context-OS Development
   额度: 500000
   过期时间: (留空，永不过期)
   ```
4. 点击 **"提交"**
5. **复制生成的令牌**，格式类似：`sk-xxxxxxxxxxxxx`

---

### 步骤 3: 更新项目配置

在项目根目录的 `.env` 文件中，确认以下配置：

```bash
# ONEAPI 网关地址
ONEAPI_BASE_URL=http://localhost:3000/v1

# ONEAPI API 密钥（粘贴刚才复制的令牌）
ONEAPI_API_KEY=sk-你复制的token
```

---

### 步骤 4: 配置 Embedding 模型渠道

1. 点击左侧菜单 **"渠道"**
2. 点击 **"新建渠道"**
3. 配置 **BAAI/bge-m3** 渠道：

#### 推荐选项：使用 SiliconFlow（有免费额度）

| 配置项 | 值 |
|--------|-----|
| 渠道类型 | `OpenAI` |
| 名称 | `SiliconFlow - BGE-M3` |
| Base URL | `https://api.siliconflow.cn/v1` |
| 密钥 | 你的 SiliconFlow API Key |

**获取 SiliconFlow API Key**：
1. 访问：https://cloud.siliconflow.cn/
2. 注册/登录账号
3. 进入 **"API密钥"** 页面
4. 创建新密钥（新用户有免费额度）

4. 点击 **"提交"**

---

### 步骤 5: 配置 K-Type 模型渠道

再次点击 **"新建渠道"**，配置 Qwen Flash：

| 配置项 | 值 |
|--------|-----|
| 渠道类型 | `OpenAI` |
| 名称 | `Dashscope - Qwen Flash` |
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 密钥 | 你的 Dashscope API Key |

**获取 Dashscope API Key**：
1. 访问：https://dashscope.aliyun.com/
2. 注册/登录账号
3. 进入 **"API-KEY 管理"**
4. 创建新 API Key（有免费额度）

---

### 步骤 6: 验证配置

运行召回测试：

```bash
npm run test:retrieval
```

如果配置正确，应该看到：
```
✅ 找到已处理的文档
ℹ️  查询向量维度: 1024
ℹ️  找到 3 个相关片段
✅ 向量检索功能正常
```

---

## Docker 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f oneapi
docker-compose logs -f qdrant

# 停止服务
docker-compose stop

# 启动服务
docker-compose start

# 重启服务
docker-compose restart

# 停止并删除容器
docker-compose down

# 停止并删除容器和数据卷
docker-compose down -v
```

---

## 服务端口

| 服务 | 端口 | 用途 |
|------|------|------|
| ONEAPI | 3000 | API 网关管理界面和 API |
| Qdrant | 6333 | 向量数据库 HTTP API |
| Qdrant | 6334 | 向量数据库 gRPC API |

---

## 数据持久化

数据存储在以下目录：

```
./data/oneapi/      # ONEAPI SQLite 数据库
./qdrant_storage/   # Qdrant 向量数据
```

⚠️ 使用 `docker-compose down -v` 会删除所有数据，请谨慎使用。

---

## 故障排查

### ONEAPI 无法访问

```bash
# 检查服务状态
docker-compose ps oneapi

# 查看日志
docker-compose logs oneapi

# 重启服务
docker-compose restart oneapi
```

### Qdrant 无法访问

```bash
# 检查服务状态
docker-compose ps qdrant

# 查看日志
docker-compose logs qdrant

# 测试连接
curl http://localhost:6333/health
```

### 端口冲突

如果端口被占用，修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "3001:3000"  # 将主机端口改为 3001
```

---

## 下一步

配置完成后：
1. ✅ 运行召回测试：`npm run test:retrieval`
2. ✅ 运行文档上传测试：`npm run test:upload`
3. ✅ 测试完整的 RAG 流程

---

## 相关文档

- [ONEAPI Embedding 配置详细指南](./docs/ONEAPI_EMBEDDING_SETUP.md)
- [环境变量配置](./.env.example)
- [Docker Compose 配置](./docker-compose.yml)
