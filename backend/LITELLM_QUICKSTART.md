# LiteLLM 快速开始指南

## 🎯 服务状态

✅ **LiteLLM** 已启动：http://localhost:4000
✅ **Qdrant** 已启动：http://localhost:6333

---

## 📝 快速配置（5 分钟）

### 步骤 1: 获取 API Keys

你需要获取以下 API Keys（选择已有账号的服务商）：

#### SiliconFlow（推荐，有免费额度）
- **用途**：Embedding (BAAI/bge-m3) + Rerank (BAAI/bge-reranker-v2-m3)
- **注册**：https://cloud.siliconflow.cn/
- **获取 Key**：登录后进入 **"API密钥"** 页面

#### Dashscope（阿里云）
- **用途**：Qwen Flash (K-Type 分析)
- **注册**：https://dashscope.aliyun.com/
- **获取 Key**：登录后进入 **"API-KEY 管理"**

#### DeepSeek
- **用途**：DeepSeek Chat (日常对话)
- **注册**：https://platform.deepseek.com/
- **获取 Key**：登录后进入 **"API Keys"** 页面

---

### 步骤 2: 更新 .env 文件

在项目根目录的 `.env` 文件中添加（或更新）以下配置：

```bash
# ==================== LiteLLM 统一网关配置 ====================
LITELLM_BASE_URL=http://localhost:4000
LITELLM_API_KEY=

# ========== 后端服务提供商 API Keys ==========
# SiliconFlow API Key（用于 Embedding 和 Rerank）
SILICONFLOW_API_KEY=sk-你的-siliconflow-api-key

# Dashscope API Key（用于 Qwen Flash）
DASHSCOPE_API_KEY=sk-你的-dashscope-api-key

# DeepSeek API Key（用于 DeepSeek Chat）
DEEPSEEK_API_KEY=sk-你的-deepseek-api-key

# ========== 模型配置 ==========
EMBEDDING_MODEL=bge-m3
RERANK_MODEL=bge-reranker-v2-m3
QWEN_FLASH_MODEL=qwen-flash
DEEPSEEK_CHAT_MODEL=deepseek-chat
```

---

### 步骤 3: 验证配置

运行 Embedding 连接测试：

```bash
npm run tsx scripts/test-embedding-connection.ts
```

**如果配置正确，应该看到**：
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
```

---

### 步骤 4: 测试完整流程

#### 召回测试（验证 Embedding + 检索）
```bash
npm run test:retrieval
```

#### 端到端测试（验证完整流程）
```bash
npm run test:e2e
```

---

## 🎨 架构说明

```
Context-OS 应用 (localhost:3010)
    ↓
LiteLLM 网关 (localhost:4000)
    ↓
├── SiliconFlow (BAAI/bge-m3 Embedding)
├── SiliconFlow (BAAI/bge-reranker-v2-m3 Rerank)
├── Dashscope (Qwen Flash)
└── DeepSeek (DeepSeek Chat)
```

**LiteLLM 的优势**：
- ✅ 统一管理所有 API 调用
- ✅ 支持 Rerank 模型（ONEAPI 不支持）
- ✅ 灵活切换模型和渠道
- ✅ 简单的 YAML 配置
- ✅ 完全兼容 OpenAI API

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
```

---

## 📊 服务端口

| 服务 | 端口 | 用途 |
|------|------|------|
| LiteLLM | 4000 | API 网关 |
| Qdrant | 6333 | 向量数据库 HTTP API |
| Qdrant | 6334 | 向量数据库 gRPC API |

---

## 🆘 故障排查

### Embedding 测试失败

**错误**：`401 Unauthorized`
- **原因**：API Key 配置错误或未配置
- **解决**：检查 `.env` 文件中的 `SILICONFLOW_API_KEY`

**错误**：`Connection refused`
- **原因**：LiteLLM 服务未启动
- **解决**：运行 `docker-compose ps` 检查服务状态

**错误**：`Model bge-m3 not found`
- **原因**：模型名称不匹配
- **解决**：确保 `.env` 中的 `EMBEDDING_MODEL=bge-m3`（不是 `BAAI/bge-m3`）

### LiteLLM 服务问题

```bash
# 查看详细日志
docker-compose logs --tail=100 litellm

# 重启服务
docker-compose restart litellm

# 完全重启
docker-compose down
docker-compose up -d
```

---

## 📚 相关文档

- [LiteLLM 迁移完成总结](docs/LITELLM_MIGRATION.md) - 详细的迁移说明
- [LiteLLM 官方文档](https://docs.litellm.ai/)
- [环境变量配置](.env.example)
- [LiteLLM 配置文件](litellm-config.yaml)

---

## 💡 提示

1. **API Keys**：建议先使用 SiliconFlow（新用户有免费额度）
2. **模型名称**：确保模型名称与代码中一致（区分大小写）
3. **端口冲突**：如果端口被占用，修改 `docker-compose.yml` 中的端口映射
4. **测试验证**：配置完成后，先运行 `npm run test:retrieval` 验证

---

## ✅ 配置检查清单

- [ ] 已获取 SiliconFlow API Key
- [ ] 已获取 Dashscope API Key
- [ ] 已获取 DeepSeek API Key
- [ ] 已更新 `.env` 文件
- [ ] LiteLLM 服务运行正常（http://localhost:4000）
- [ ] Embedding 测试通过
- [ ] 召回测试通过

---

现在开始配置 API Keys，然后运行测试验证！🚀
