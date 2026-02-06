# OneAPI 统一配置 - 快速开始

## 📝 概述

项目已迁移到统一使用 **OneAPI** 网关管理所有 LLM 调用。这样做的好处：

- ✅ **统一管理**: 所有模型通过一个网关调用
- ✅ **易于切换**: 修改环境变量即可切换模型
- ✅ **负载均衡**: 可配置多个渠道，自动分配请求
- ✅ **故障转移**: 某个渠道失败时自动切换

## 🚀 本地开发环境设置

### 1. 启动 OneAPI

```bash
# 使用项目提供的 Docker Compose 配置
docker-compose -f docker-compose.oneapi.yml up -d

# 查看日志
docker-compose -f docker-compose.oneapi.yml logs -f one-api
```

### 2. 初始化 OneAPI

1. 访问 http://localhost:3000
2. 首次访问会要求创建管理员账号
3. 登录后进入管理后台

### 3. 创建 API 令牌

1. 进入 **"令牌"** 页面
2. 点击 **"新建令牌"**
3. 输入名称（如：`context-os-dev`）
4. 设置额度（建议：`500000`）
5. 复制生成的令牌（格式：`sk-xxxxx`）

### 4. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写以下配置：
nano .env
```

```env
# OneAPI 基础地址
ONEAPI_BASE_URL=http://localhost:3000/v1

# OneAPI API 密钥（刚才创建的令牌）
ONEAPI_API_KEY=sk-your-token-here

# 默认模型
ONEAPI_MODEL=deepseek-chat
```

### 5. 添加模型渠道（在 OneAPI 管理后台）

#### DeepSeek 渠道

1. 进入 **"渠道"** 页面
2. 点击 **"新建渠道"**
3. 配置：
   - **类型**: `OpenAI`
   - **名称**: `DeepSeek`
   - **Base URL**: `https://api.deepseek.com/v1`
   - **密钥**: (你的 DeepSeek API Key)
   - **模型**: `deepseek-chat`
   - **重定向**: 取消勾选

#### Qwen 渠道（可选）

1. 进入 **"渠道"** 页面
2. 点击 **"新建渠道"**
3. 配置：
   - **类型**: `OpenAI`
   - **名称**: `Qwen`
   - **Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - **密钥**: (你的阿里云 DashScope API Key)
   - **模型**: `qwen-max`, `qwen-plus`
   - **重定向**: 取消勾选

### 6. 测试配置

```bash
# 运行测试脚本
npx tsx scripts/test-oneapi-setup.ts
```

## 💻 代码使用

### 基础使用

```typescript
import { createLLMClient } from '@/lib/llm-client'

// 使用默认配置
const client = createLLMClient('oneapi')

const { content } = await client.chat([
  { role: 'user', content: '你好' }
])
```

### 切换模型

```typescript
// 使用 DeepSeek
const deepseek = createLLMClient('oneapi_deepseek')

// 使用 Qwen Max
const qwen = createLLMClient('oneapi_qwen_max')

// 使用 Qwen Plus
const qwenPlus = createLLMClient('oneapi_qwen_plus')
```

### 流式请求

```typescript
const { content, metrics } = await client.chatStream(
  [{ role: 'user', content: '介绍一下你自己' }],
  {
    onEvent: (event) => {
      if (event.type === 'delta') {
        console.log(event.content)
      }
    }
  }
)
```

## 🔧 配置说明

### 可用的模型配置

| 配置键 | 说明 | 环境变量 |
|--------|------|----------|
| `oneapi` | 默认配置 | `ONEAPI_MODEL` |
| `oneapi_deepseek` | DeepSeek Chat | `ONEAPI_MODEL_DEEPSEEK` |
| `oneapi_deepseek_v3` | DeepSeek V3 | `ONEAPI_MODEL_DEEPSEEK_V3` |
| `oneapi_qwen_max` | Qwen Max | `ONEAPI_MODEL_QWEN_MAX` |
| `oneapi_qwen_plus` | Qwen Plus | `ONEAPI_MODEL_QWEN_PLUS` |
| `oneapi_gpt4` | GPT-4 | `ONEAPI_MODEL_GPT4` |
| `oneapi_gpt35` | GPT-3.5 Turbo | `ONEAPI_MODEL_GPT35` |

### 生产环境配置

```env
# 使用服务器上的 OneAPI
ONEAPI_BASE_URL=https://your-oneapi-server.com/v1
ONEAPI_API_KEY=sk-your-production-token
ONEAPI_MODEL=deepseek-chat
```

## 🔍 测试和调试

### 运行测试脚本

```bash
npx tsx scripts/test-oneapi-setup.ts
```

测试脚本会：
- ✅ 验证 OneAPI 连接
- ✅ 测试各个模型配置
- ✅ 显示详细的错误信息（如果失败）

### 查看 OneAPI 日志

```bash
# Docker 日志
docker-compose -f docker-compose.oneapi.yml logs -f one-api

# 使用日志
```

在 OneAPI 管理后台的 **"使用日志"** 中可以看到：
- 调用时间
- 使用的模型
- 消耗的 token 数量
- 调用状态

## ❓ 常见问题

### Q: OneAPI 无法启动？

```bash
# 检查端口占用
netstat -ano | findstr :3000

# 查看日志
docker-compose -f docker-compose.oneapi.yml logs one-api
```

### Q: 测试脚本报错 "API Key 未配置"？

1. 确保已创建 `.env` 文件
2. 检查 `ONEAPI_API_KEY` 是否填写
3. 确认令牌格式正确（以 `sk-` 开头）

### Q: 调用返回 401 错误？

1. 检查 OneAPI 渠道的 API Key 是否正确
2. 确认令牌是否有效（未过期、未超出额度）
3. 确认模型名称匹配

### Q: 如何切换到服务器上的 OneAPI？

修改 `.env` 文件：

```env
ONEAPI_BASE_URL=https://your-server.com/v1
ONEAPI_API_KEY=sk-your-server-token
```

## 📚 更多信息

- [详细配置指南](./ONEAPI_SETUP.md)
- [OneAPI 官方文档](https://github.com/songquanpeng/one-api)
- [Docker Compose 配置](../docker-compose.oneapi.yml)
- [LLM 客户端代码](../lib/llm-client.ts)
