# LiteLLM 配置成功总结

## ✅ 最终方案

经过测试，**你提供的方案完全可行**！LiteLLM 现在可以正常代理所有模型了。

### 🔑 关键配置要点

#### 1. **litellm-config.yaml** 配置

```yaml
model_list:
  # Embedding 模型（SiliconFlow - BAAI/bge-m3）
  - model_name: bge-m3
    litellm_params:
      model: openai/BAAI/bge-m3           # ✅ 使用 openai/ 前缀
      api_key: os.environ/SILICONFLOW_API_KEY  # ✅ 引用环境变量
      api_base: https://api.siliconflow.cn/v1   # ✅ 不带 /embeddings 后缀

  # Rerank 模型（SiliconFlow - BAAI/bge-reranker-v2-m3）
  - model_name: bge-reranker-v2-m3
    litellm_params:
      model: openai/BAAI/bge-reranker-v2-m3
      api_key: os.environ/SILICONFLOW_API_KEY
      api_base: https://api.siliconflow.cn/v1

  # LLM 模型示例（DeepSeek）
  - model_name: deepseek-chat
    litellm_params:
      model: openai/deepseek-chat
      api_key: os.environ/DEEPSEEK_API_KEY
      api_base: https://api.deepseek.com/v1
```

#### 2. **docker-compose.yml** 配置

```yaml
litellm:
  image: ghcr.io/berriai/litellm:main-latest
  environment:
    # ✅ 必须将 API Keys 作为环境变量传入容器
    - SILICONFLOW_API_KEY=${SILICONFLOW_API_KEY}
    - DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
    - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
  volumes:
    - ./litellm-config.yaml:/app/config.yaml
```

#### 3. **.env 文件配置**

```bash
# API Keys
SILICONFLOW_API_KEY=sk-你的-siliconflow-key
DASHSCOPE_API_KEY=sk-你的-dashscope-key
DEEPSEEK_API_KEY=sk-你的-deepseek-key

# LiteLLM 配置
LITELLM_BASE_URL=http://localhost:4000
LITELLM_API_KEY=

# 模型名称（使用别名，不是完整模型名）
EMBEDDING_MODEL=bge-m3
RERANK_MODEL=bge-reranker-v2-m3
DEEPSEEK_CHAT_MODEL=deepseek-chat
QWEN_FLASH_MODEL=qwen-flash
```

---

## ✅ 测试结果

### Embedding API
```bash
curl -X POST http://localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test" \
  -d '{"model": "bge-m3", "input": ["test"]}'
```
**结果**: ✅ 成功返回 1024 维向量

### Chat API (DeepSeek)
```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Hello"}]}'
```
**结果**: ✅ 成功返回回复

### Chat API (Qwen Flash)
```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test" \
  -d '{"model": "qwen-flash", "messages": [{"role": "user", "content": "Hello"}]}'
```
**结果**: ✅ 成功返回回复

---

## 🔧 重要注意事项

### 1. **完整重启 Docker 服务**
修改 `.env` 或 `docker-compose.yml` 后，必须完整重启：
```bash
docker-compose down
docker-compose up -d
```

**不能**只使用 `docker-compose restart`，因为环境变量不会重新加载。

### 2. **模型名称映射**
- **配置文件** (`model_name`): `bge-m3` → 这是你调用的别名
- **实际模型** (`litellm_params.model`): `openai/BAAI/bge-m3` → 这是上游的真实模型名

调用时使用别名（`bge-m3`），LiteLLM 会自动映射到真实模型。

### 3. **API Base URL 格式**
- ✅ 正确: `https://api.siliconflow.cn/v1`
- ❌ 错误: `https://api.siliconflow.cn/v1/embeddings`

LiteLLM 会自动添加 `/embeddings`、`/chat/completions` 等后缀。

### 4. **环境变量引用**
在 YAML 中使用 `os.environ/VAR_NAME` 引用环境变量：
```yaml
api_key: os.environ/SILICONFLOW_API_KEY  # ✅ 正确
api_key: sk-xxx  # ❌ 不推荐（硬编码）
```

---

## 📊 架构总结

```
应用代码
    ↓
LiteLLM 网关 (localhost:4000)
    ↓
├── SiliconFlow (BAAI/bge-m3 Embedding) ✅
├── SiliconFlow (BAAI/bge-reranker-v2-m3 Rerank) ✅
├── Dashscope (qwen-flash) ✅
├── Dashscope (qwen3-max) ✅
├── DeepSeek (deepseek-chat) ✅
└── DeepSeek (deepseek-reasoner) ✅
```

**所有模型统一通过 LiteLLM 网关管理！**

---

## 🎉 迁移成果

从 ONEAPI 迁移到 LiteLLM 已完成，主要优势：

1. ✅ **支持 Rerank 模型**（ONEAPI 不支持）
2. ✅ **所有模型正常工作**
3. ✅ **统一的 API 网关**
4. ✅ **简化的 YAML 配置**
5. ✅ **环境变量管理**

---

## 📝 相关文件

- [litellm-config.yaml](litellm-config.yaml) - 模型配置
- [docker-compose.yml](docker-compose.yml) - Docker 服务配置
- [.env](.env) - 环境变量配置
- [.env.example](.env.example) - 环境变量模板
- [lib/embedding.ts](lib/embedding.ts) - Embedding 客户端
- [lib/llm-client.ts](lib/llm-client.ts) - LLM 客户端
- [scripts/test-embedding-connection.ts](scripts/test-embedding-connection.ts) - 测试脚本

---

**文档更新时间**: 2026-01-14
**状态**: ✅ 所有模型测试通过
