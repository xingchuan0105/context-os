# Embedding API 工作方案说明

## 问题描述

LiteLLM 在处理 OpenAI 兼容的 Embedding 请求时存在 bug，导致无法正确将模型参数传递给上游 API。

### 错误现象
```
{'error': '/embeddings: Invalid model name passed in model=None'}
```

### 根本原因
LiteLLM 的 Embedding 代理在处理 OpenAI 兼容端点时，没有正确将 `model_name` 映射到实际的 `model` 参数，导致 `model=None` 被传递给上游 API。

### 相关 Issue
- GitHub: https://github.com/BerriAI/litellm/issues/8077

---

## 临时解决方案

### 实施的方案
**直接调用 SiliconFlow API，绕过 LiteLLM**

### 架构调整
```
之前：
Embedding → LiteLLM → SiliconFlow (失败 ❌)

现在：
Embedding → SiliconFlow (成功 ✅)
Chat/K-Type → LiteLLM → 各 LLM 提供商 (正常 ✅)
```

### 具体改动

#### 1. 更新 [lib/embedding.ts](../lib/embedding.ts)
```typescript
// 之前：通过 LiteLLM
const baseURL = process.env.LITELLM_BASE_URL || 'http://localhost:4000'

// 现在：直接调用 SiliconFlow
const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1'
const apiKey = process.env.SILICONFLOW_API_KEY
```

#### 2. 更新 [.env](../.env) 配置
```bash
# SiliconFlow API 配置（直接调用）
SILICONFLOW_API_KEY=sk-your-siliconflow-api-key-here
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1

# Embedding 模型（使用完整模型名）
EMBEDDING_MODEL=BAAI/bge-m3
```

#### 3. 保留 LiteLLM 配置
- LLM 模型继续使用 LiteLLM
- Rerank 模型继续使用 LiteLLM
- 仅 Embedding 功能绕过 LiteLLM

---

## 测试验证

### 运行 Embedding 测试
```bash
npx tsx scripts/test-embedding-connection.ts
```

**预期输出**：
```
✅ Embedding API 调用成功！
  耗时: 255ms
  向量维度: 1024
  数据预览: -0.064, 0.010, -0.014, ...
```

### 验证结果
- ✅ Embedding API 调用成功
- ✅ 返回 1024 维向量（符合 BAAI/bge-m3 规格）
- ✅ 响应时间合理（~250ms）

---

## 优缺点分析

### 优点
1. **稳定性**：直接调用上游 API，避免中间层的 bug
2. **性能**：减少一跳代理，降低延迟
3. **可靠性**：不受 LiteLLM 版本更新影响

### 缺点
1. **统一管理**：无法通过 LiteLLM 统一管理 Embedding 调用
2. **监控**：需要在应用层单独监控 Embedding 调用
3. **灵活性**：切换模型需要修改代码，无法通过配置文件

---

## 长期计划

### 待 LiteLLM 修复后
1. 恢复通过 LiteLLM 调用 Embedding
2. 实现统一的 API 网关管理
3. 统一监控和日志记录

### 切换步骤
1. 更新 `lib/embedding.ts` 中的 baseURL 改回 LiteLLM
2. 验证 LiteLLM 已修复 bug
3. 测试所有 Embedding 相关功能
4. 逐步迁移回 LiteLLM

---

## 相关配置文件

- **Embedding 客户端**: [lib/embedding.ts](../lib/embedding.ts)
- **环境变量配置**: [.env](../.env)
- **环境变量模板**: [.env.example](../.env.example)
- **测试脚本**: [scripts/test-embedding-connection.ts](../scripts/test-embedding-connection.ts)

---

## 其他说明

### LLM 和 Rerank 继续使用 LiteLLM
- Chat 模型（deepseek-chat, qwen-flash 等）
- Rerank 模型（bge-reranker-v2-m3）
- 这些功能不受影响，正常工作

### 为什么不全部绕过 LiteLLM？
1. **Rerank 支持**：迁移到 LiteLLM 的主要原因就是支持 Rerank
2. **统一管理**：LLM 模型通过 LiteLLM 更便于管理
3. **故障转移**：LiteLLM 提供负载均衡和故障转移能力

---

## 参考资料

- [LiteLLM OpenAI 兼容端点文档](https://docs.litellm.ai/docs/providers/openai_compatible)
- [SiliconFlow Embedding API 文档](https://docs.siliconflow.cn/cn/api-reference/embeddings/create-embeddings)
- [LiteLLM Issue #8077](https://github.com/BerriAI/litellm/issues/8077)

---

**文档更新时间**: 2026-01-14
**状态**: ✅ 临时方案已实施并验证
