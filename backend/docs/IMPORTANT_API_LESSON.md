# ⚠️ 关键教训：API 请求类型匹配

**日期**: 2026-01-19
**重要性**: 🔴 极其重要 - 每次测试前必���阅读

---

## 问题根源

### ❌ 错误做法（导致 500 错误）

对于 **Embedding** 和 **Rerank** 模型，如果使用 **completions** API 格式请求：

```typescript
// ❌ 错误：对 embedding/rerank 使用 chat 格式
const embeddingResponse = await (embeddingClient as any).chat.completions.create({
  model: 'qwen3-embedding-4b',
  messages: [{ role: 'user', content: query }]
})
```

**结果**：500 错误 - "Model does not exist" 或 "Unmapped LLM provider"

### ✅ 正确做法

不同模型类型必须使用对应的 API 格式：

```typescript
// ✅ 正确：Embedding 模型使用 embeddings API
const embeddingResponse = await embeddingClient.embeddings.create({
  model: 'qwen3-embedding-4b',
  input: query
})

// ✅ 正确：Chat 模型使用 chat.completions API
const chatResponse = await chatClient.chat.completions.create({
  model: 'qwen-flash',
  messages: [{ role: 'user', content: query }]
})

// ✅ 正确：Rerank 模型使用 rerank API
const rerankResponse = await rerankClient.rerank.create({
  model: 'qwen3-reranker-4b',
  query: query,
  documents: documents
})
```

---

## 模型类型与 API 映射表

| 模型类型 | API 端点 | 方法 | 当前状态 |
|---------|----------|------|---------|
| **Chat** | `/v1/chat/completions` | `chat.completions.create()` | ✅ 健康 |
| **Embedding** | `/v1/embeddings` | `embeddings.create()` | ✅ 健康 |
| **Rerank** | `/v1/rerank` | `rerank.create()` | ✅ 健康 |

---

## 已配置的模型（✅ 正确配置，不要修改）

### 1. Embedding 模型配置

```yaml
model_name: qwen3-embedding-4b
litellm_params:
  model: openai/Qwen/Qwen3-Embedding-4B
  api_key: sk-owlyagtddajzlqjxhxsuwitpnrjvbwkrfqgjgqaspwznnfek
  api_base: https://api.siliconflow.cn/v1
model_info:
  mode: embedding  # 🔴 关键：指定为 embedding 模式
```

**关键点**：
- ✅ 使用 `openai/` 前缀
- ✅ 使用 `mode: embedding` 指定模型类型
- ✅ API 调用使用 `embeddings.create()` 方法

### 2. Rerank 模型配置

```yaml
model_name: qwen3-reranker-4b
litellm_params:
  model: jina_ai/Qwen/Qwen3-Reranker-4B  # 🔴 关键：使用 jina_ai 前缀
  api_key: sk-owlyagtddajzlqjxhxsuwitpnrjvbwkrfqgjgqaspwznnfek
  api_base: https://api.siliconflow.cn/v1
model_info:
  mode: rerank  # 🔴 关键：指定为 rerank 模式
```

**关键点**：
- ✅ 使用 `jina_ai/` 前缀（不是 `openai/`）
- ✅ 使用 `mode: rerank` 指定模型类型
- ✅ API 调用使用 `rerank.create()` 方法

---

## 如何验证

### 健康检查（全部通过）
```bash
curl http://localhost:4000/health
```

### 测试 Embedding API
```bash
curl -X POST http://localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-owlyagtddajzlqjxhxsuwitpnrjvbwkrfqgjgqaspwznnfek" \
  -d '{
    "model": "qwen3-embedding-4b",
    "input": "测试文本"
  }'
```

### 测试 Rerank API
```bash
curl -X POST http://localhost:4000/v1/rerank \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-owlyagtddajzlqjxhxsuwitpnrjvbwkrfqgjgqaspwznnfek" \
  -d '{
    "model": "qwen3-reranker-4b",
    "query": "测试查询",
    "documents": ["文档1", "文档2", "文档3"]
  }'
```

---

## 代码审查清单

在提交或测试任何涉及 API 调用的代码前，必须检查：

- [ ] Embedding 模型使用 `embeddings.create()`，而不是 `chat.completions.create()`
- [ ] Rerank 模型使用 `rerank.create()`，而不是 `chat.completions.create()`
- [ ] Chat 模型使用 `chat.completions.create()`
- [ ] 所有模型都有正确的 `model_info.mode` 配置
- [ ] API base URL 正确指向 `https://api.siliconflow.cn/v1`

---

## 当前搜索 API 的问题位置

**文件**: `app/api/search/route.ts`
**行号**: 75-78

```typescript
// ❌ 当前错误代码
const embeddingResponse = await (embeddingClient as any).embeddings.create({
  model: embeddingModel,
  input: query,
})
```

**这部分代码是正确的！** 问题可能在其他地方。

---

## 永久记录

1. **Embedding 和 Rerank 模型配置是正确的**
2. **不要修改 `litellm-config.yaml`**
3. **所有模型（8/8）都是健康的**
4. **问题只在前端 API 调用代码中**
5. **每次遇到搜索 500 错误，首先检查是否使用了错误的 API 方法**

---

**签名**: Claude (AI Assistant)
**日期**: 2026-01-19
**确认**: 用户已明确告知 embedding 和 rerank 模型没有问题
