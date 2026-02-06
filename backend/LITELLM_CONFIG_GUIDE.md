# LiteLLM 配置说明

## 🎯 LiteLLM 与 ONEAPI 的区别

### ONEAPI（之前的方案）
- ✅ 有 Web 管理界面（http://localhost:3000）
- ✅ 可视化配置渠道和令牌
- ❌ **不支持 Rerank 模型**

### LiteLLM（当前方案）
- ✅ **支持 Rerank 模型**（迁移原因）
- ✅ 更简单的配置（YAML 文件）
- ✅ 更好的文档和社区支持
- ⚠️ **没有 Web 管理界面**（通过配置文件管理）

---

## 📝 LiteLLM 配置方式

LiteLLM **不需要 Web 界面**，它通过以下两个文件配置：

### 1. litellm-config.yaml（模型配置）

这个文件定义了所有可用的模型：

```yaml
model_list:
  # Embedding 模型
  - model_name: bge-m3
    litellm_params:
      model: openai/BAAI/bge-m3
      api_key: os.environ/SILICONFLOW_API_KEY
      api_base: https://api.siliconflow.cn/v1

  # Rerank 模型
  - model_name: bge-reranker-v2-m3
    litellm_params:
      model: openai/BAAI/bge-reranker-v2-m3
      api_key: os.environ/SILICONFLOW_API_KEY
      api_base: https://api.siliconflow.cn/v1

  # LLM 模型
  - model_name: qwen-flash
    litellm_params:
      model: openai/qwen-flash
      api_key: os.environ/DASHSCOPE_API_KEY
      api_base: https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 2. .env（API Keys）

这个文件存储实际的 API Keys：

```bash
SILICONFLOW_API_KEY=sk-你的-siliconflow-api-key
DASHSCOPE_API_KEY=sk-你的-dashscope-api-key
DEEPSEEK_API_KEY=sk-你的-deepseek-api-key
```

---

## 🚀 快速配置步骤

### 步骤 1：获取 API Keys

你需要获取以下 API Keys（**至少需要一个**）：

#### SiliconFlow（推荐，有免费额度）
- **用途**：Embedding + Rerank
- **注册**：https://cloud.siliconflow.cn/
- **获取**：登录 → API密钥 → 创建新密钥

#### Dashscope（阿里云）
- **用途**：Qwen Flash（K-Type 分析）
- **注册**：https://dashscope.aliyun.com/
- **获取**：登录 → API-KEY 管理 → 创建新 Key

#### DeepSeek
- **用途**：DeepSeek Chat（日常对话）
- **注册**：https://platform.deepseek.com/
- **获取**：登录 → API Keys → 创建新 Key

### 步骤 2：更新 .env 文件

在项目根目录的 `.env` 文件中添加：

```bash
# SiliconFlow API Key（必需，用于 Embedding 和 Rerank）
SILICONFLOW_API_KEY=sk-粘贴你的-key-这里

# Dashscope API Key（可选，用于 Qwen Flash）
DASHSCOPE_API_KEY=sk-粘贴你的-key-这里

# DeepSeek API Key（可选，用于 DeepSeek Chat）
DEEPSEEK_API_KEY=sk-粘贴你的-key-这里
```

### 步骤 3：验证配置

运行测试：

```bash
npm run tsx scripts/test-embedding-connection.ts
```

**如果成功，你会看到**：
```
🔍 测试 Embedding API 连接...

配置信息：
  LITELLM_BASE_URL: http://localhost:4000
  SILICONFLOW_API_KEY: 已配置
  EMBEDDING_MODEL: bge-m3

调用 Embedding API...

✅ Embedding API 调用成功！
  耗时: XXXms
  向量维度: 1024
```

---

## 🔍 如何验证 LiteLLM 是否工作

### 方法 1：健康检查

```bash
curl http://localhost:4000/health
```

**预期输出**：
```json
{"status": "ok"}
```

### 方法 2：查看日志

```bash
docker-compose logs -f litellm
```

**正常运行的日志示例**：
```
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:4000
```

### 方法 3：测试 API 调用

```bash
npm run tsx scripts/test-embedding-connection.ts
```

---

## 📊 服务状态检查

### 查看所有服务

```bash
docker-compose ps
```

**预期输出**：
```
NAME                 STATUS                            PORTS
context-os-litellm   Up 2 minutes (health: healthy)   0.0.0.0:4000->4000/tcp
context-os-qdrant    Up 2 minutes (health: healthy)   0.0.0.0:6333-6334->6333-6334/tcp
```

### 查看服务日志

```bash
# LiteLLM 日志
docker-compose logs -f litellm

# Qdrant 日志
docker-compose logs -f qdrant

# 所有服务日志
docker-compose logs -f
```

---

## 🛠️ 常见问题

### Q1: 为什么 localhost:4000 无法打开？

**A**: LiteLLM **没有 Web 管理界面**，这是正常的！

LiteLLM 是一个 API 服务器，不是 Web 应用。你不需要在浏览器中访问它。

- ✅ **正确**：通过代码/脚本调用 API
- ❌ **错误**：在浏览器中打开 http://localhost:4000

### Q2: 如何查看 LiteLLM 是否正常工作？

**A**: 使用以下命令检查：

```bash
# 1. 健康检查
curl http://localhost:4000/health

# 2. 查看日志
docker-compose logs litellm

# 3. 运行测试
npm run tsx scripts/test-embedding-connection.ts
```

### Q3: Embedding 测试失败怎么办？

**错误**: `401 Unauthorized`
- **原因**：API Key 未配置或配置错误
- **解决**：检查 `.env` 文件中的 `SILICONFLOW_API_KEY`

**错误**: `Model bge-m3 not found`
- **原因**：LiteLLM 配置文件有问题
- **解决**：确认 `litellm-config.yaml` 中有 `bge-m3` 的配置

**错误**: `Connection refused`
- **原因**：LiteLLM 服务未启动
- **解决**：运行 `docker-compose ps` 检查服务状态

### Q4: 如何添加新模型？

编辑 `litellm-config.yaml`，添加新的模型配置：

```yaml
model_list:
  # 添加新模型
  - model_name: your-model-name
    litellm_params:
      model: openai/your-model-name
      api_key: os.environ/YOUR_API_KEY
      api_base: https://your-provider.com/v1
```

然后在 `.env` 文件中添加对应的 API Key：

```bash
YOUR_API_KEY=sk-your-api-key
```

最后重启服务：

```bash
docker-compose restart litellm
```

---

## 💡 配置建议

### 最小配置（测试用）

如果只想测试 Embedding 功能，只需要配置：

```bash
# .env 文件
SILICONFLOW_API_KEY=sk-你的-siliconflow-key
```

这就能支持：
- ✅ Embedding (bge-m3)
- ✅ Rerank (bge-reranker-v2-m3)

### 完整配置（生产用）

```bash
# .env 文件
SILICONFLOW_API_KEY=sk-你的-siliconflow-key  # Embedding + Rerank
DASHSCOPE_API_KEY=sk-你的-dashscope-key      # Qwen Flash
DEEPSEEK_API_KEY=sk-你的-deepseek-key        # DeepSeek Chat
```

这能支持所有功能：
- ✅ Embedding (bge-m3)
- ✅ Rerank (bge-reranker-v2-m3)
- ✅ K-Type 分析 (qwen-flash)
- ✅ 日常对话 (deepseek-chat)

---

## 📚 相关文档

- [LiteLLM 官方文档](https://docs.litellm.ai/)
- [LiteLLM 配置参考](https://docs.litellm.ai/docs/proxy/configs)
- [迁移完成总结](docs/LITELLM_MIGRATION.md)
- [快速开始指南](LITELLM_QUICKSTART.md)

---

## ✅ 配置检查清单

完成以下步骤后，LiteLLM 就能正常工作：

- [ ] Docker 服务运行正常（`docker-compose ps`）
- [ ] 至少配置了一个 API Key（推荐 SiliconFlow）
- [ ] `.env` 文件中的 API Key 已正确填写
- [ ] LiteLLM 健康检查通过（`curl http://localhost:4000/health`）
- [ ] Embedding 测试通过（`npm run tsx scripts/test-embedding-connection.ts`）

---

现在请在 `.env` 文件中配置 API Keys，然后运行测试！🚀
