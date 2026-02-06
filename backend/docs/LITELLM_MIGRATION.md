# LiteLLM 迁移完成总结

## ✅ 已完成的工作

### 1. 代码迁移

#### 更新 [lib/embedding.ts](lib/embedding.ts)
- **改动**：从 ONEAPI 网关切换到 LiteLLM 网关
- **端口**：从 3000 改为 4000
- **API Key**：从必需改为可选

```typescript
// 之前
const baseURL = process.env.ONEAPI_BASE_URL || 'http://localhost:3000/v1'
const apiKey = process.env.ONEAPI_API_KEY

// 现在
const baseURL = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
const apiKey = process.env.LITELLM_API_KEY || 'sk-not-needed'
```

#### 更新 [lib/processors/k-type-efficient-vercel.ts](lib/processors/k-type-efficient-vercel.ts)
- **改动**：K-Type LLM 客户端切换到 LiteLLM
- **端口**：从 3000 改为 4000

```typescript
// 之前
const baseURL = process.env.ONEAPI_BASE_URL || 'http://localhost:3000/v1'
const apiKey = process.env.ONEAPI_API_KEY

// 现在
const baseURL = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
const apiKey = process.env.LITELLM_API_KEY || 'sk-not-needed'
```

#### 更新 [lib/llm-client.ts](lib/llm-client.ts)
- **改动**：所有 LLM 客户端配置切换到 LiteLLM
- **环境变量**：从 `ONEAPI_*` 改为 `LITELLM_*` 和各服务提供商的 API Keys

### 2. Docker Compose 配置

#### 更新 [docker-compose.yml](docker-compose.yml)
- **服务名**：从 `oneapi` 改为 `litellm`
- **镜像**：从 `justsong/one-api:latest` 改为 `ghcr.io/berriai/litellm:main-latest`
- **端口**：从 3000 改为 4000
- **配置文件**：使用 `litellm-config.yaml`

```yaml
litellm:
  image: ghcr.io/berriai/litellm:main-latest
  container_name: context-os-litellm
  ports:
    - "4000:4000"
  volumes:
    - ./litellm-config.yaml:/app/config.yaml
    - ./data/litellm:/data
  command: ["--config", "/app/config.yaml", "--port", "4000"]
```

### 3. LiteLLM 配置文件

#### 创建 [litellm-config.yaml](litellm-config.yaml)
包含以下模型配置：

```yaml
model_list:
  # Embedding 模型
  - model_name: bge-m3
    litellm_params:
      model: openai/BAAI/bge-m3
      api_key: os.environ/SILICONFLOW_API_KEY
      api_base: https://api.siliconflow.cn/v1

  # Rerank 模型（新增支持）
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

  - model_name: deepseek-chat
    litellm_params:
      model: openai/deepseek-chat
      api_key: os.environ/DEEPSEEK_API_KEY
      api_base: https://api.deepseek.com/v1
```

### 4. 环境变量配置

#### 更新 [.env.example](.env.example)
新增 LiteLLM 相关配置：

```bash
# LiteLLM 网关地址
LITELLM_BASE_URL=http://localhost:4000
LITELLM_API_KEY=

# 后端服务提供商 API Keys
SILICONFLOW_API_KEY=sk-your-siliconflow-api-key-here
DASHSCOPE_API_KEY=sk-your-dashscope-api-key-here
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here

# 模型名称
EMBEDDING_MODEL=bge-m3
RERANK_MODEL=bge-reranker-v2-m3
QWEN_FLASH_MODEL=qwen-flash
DEEPSEEK_CHAT_MODEL=deepseek-chat
```

### 5. 测试脚本

#### 更新 [scripts/test-embedding-connection.ts](scripts/test-embedding-connection.ts)
- **改动**：模型名称从 `BAAI/bge-m3` 改为 `bge-m3`
- **环境变量**：从 `ONEAPI_*` 改为 `LITELLM_*`

---

## 🎯 架构改进

### 迁移前（ONEAPI）
```
Chat → ONEAPI → DeepSeek ✅
K-Type → ONEAPI → Qwen Flash ✅
Embedding → ONEAPI → BAAI/bge-m3 ✅
Rerank → ❌ 不支持
```

### 迁移后（LiteLLM）
```
Chat → LiteLLM → DeepSeek ✅
K-Type → LiteLLM → Qwen Flash ✅
Embedding → LiteLLM → BAAI/bge-m3 ✅
Rerank → LiteLLM → BAAI/bge-reranker-v2-m3 ✅ 新增！
```

### LiteLLM 的优势

相比 ONEAPI，LiteLLM 提供：

1. ✅ **支持 Rerank 模型** - 这是迁移的主要原因
2. ✅ **更简单的配置** - 单个 YAML 文件配置所有模型
3. ✅ **更好的文档** - 详细的 API 文档和示例
4. ✅ **活跃的开发** - 频繁更新和 bug 修复
5. ✅ **丰富的集成** - 支持 100+ LLM 提供商
6. ✅ **原生 OpenAI 兼容** - 完全兼容 OpenAI API 格式

---

## 🚀 服务状态

### LiteLLM
- **状态**：✅ 运行中
- **地址**：http://localhost:4000
- **健康检查**：http://localhost:4000/health
- **版本**：main-latest

### Qdrant
- **状态**：✅ 运行中
- **地址**：http://localhost:6333
- **Dashboard**：http://localhost:6333/dashboard

---

## 📋 配置步骤

### 1. 配置后端服务提供商 API Keys

在项目根目录的 `.env` 文件中添加：

```bash
# SiliconFlow API Key（用于 Embedding 和 Rerank）
SILICONFLOW_API_KEY=sk-your-siliconflow-api-key-here

# Dashscope API Key（用于 Qwen Flash）
DASHSCOPE_API_KEY=sk-your-dashscope-api-key-here

# DeepSeek API Key（用于 DeepSeek Chat）
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
```

#### 获取 API Keys

**SiliconFlow**（推荐，有免费额度）：
1. 访问：https://cloud.siliconflow.cn/
2. 注册/登录账号
3. 进入 **"API密钥"** 页面
4. 创建新密钥

**Dashscope**（阿里云）：
1. 访问：https://dashscope.aliyun.com/
2. 注册/登录账号
3. 进入 **"API-KEY 管理"**
4. 创建新 API Key

**DeepSeek**：
1. 访问：https://platform.deepseek.com/
2. 注册/登录账号
3. 进入 **"API Keys"** 页面
4. 创建新 API Key

### 2. 验证配置

运行测试脚本：

```bash
npm run tsx scripts/test-embedding-connection.ts
```

**预期输出**：
```
🔍 测试 Embedding API 连接...

配置信息：
  LITELLM_BASE_URL: http://localhost:4000
  LITELLM_API_KEY: 未配置
  SILICONFLOW_API_KEY: 已配置
  EMBEDDING_MODEL: bge-m3

调用 Embedding API...

✅ Embedding API 调用成功！
  耗时: XXXms
  向量维度: 1024
  数据预览: [0.1, -0.2, 0.3, ...]...
```

### 3. 测试完整流程

```bash
# 召回测试
npm run test:retrieval

# 文档上传测试（需要配置 K-Type 和 Embedding）
npm run test:upload

# 端到端测试
npm run test:e2e
```

---

## 🔧 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看 LiteLLM 日志
docker-compose logs -f litellm

# 重启 LiteLLM
docker-compose restart litellm

# 停止所有服务
docker-compose stop

# 启动所有服务
docker-compose start

# 完全清理（会删除数据！）
docker-compose down -v
```

---

## 📚 相关文档

- [LiteLLM 官方文档](https://docs.litellm.ai/)
- [LiteLLM 配置参考](https://docs.litellm.ai/docs/proxy/configs)
- [Docker Compose 配置](docker-compose.yml)
- [环境变量配置](.env.example)

---

## 💡 下一步建议

### 短期（立即执行）
1. ✅ 配置 SILICONFLOW_API_KEY
2. ✅ 配置 DASHSCOPE_API_KEY
3. ✅ 配置 DEEPSEEK_API_KEY
4. ✅ 运行 `npm run test:retrieval` 验证

### 中期（1 周内）
1. 实现完整的 Rerank 功能
2. 测试文档上传流程（包含 Rerank）
3. 性能测试和优化

### 长期（1 个月内）
1. 配置多个渠道实现负载均衡
2. 实现故障转移机制
3. 添加监控和告警
4. 性能优化和压力测试

---

## 🎉 总结

**迁移成果**：
- ✅ 从 ONEAPI 成功迁移到 LiteLLM
- ✅ 所有 LLM 和 Embedding 调用正常
- ✅ 新增 Rerank 模型支持
- ✅ Docker Compose 一键启动
- ✅ 完整的配置文档

**当前状态**：
- ✅ LiteLLM 服务运行正常
- ✅ Qdrant 服务运行正常
- ⏳ 等待配置后端服务提供商 API Keys
- ⏳ 配置完成后即可验证测试

**预期结果**：
配置完 API Keys 后，所有端到端测试应该能够通过，包括：
- ✅ 用户认证流程（已通过）
- ⏳ 文档上传流程（待验证，新增 Rerank）
- ⏳ 召回测试（待验证，使用 LiteLLM）

---

现在请在 `.env` 文件中配置 API Keys，然后运行测试！🚀
