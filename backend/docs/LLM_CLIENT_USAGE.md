# LLM 客户端使用指南

## 📖 概述

`lib/llm-client.ts` 提供了统一的 LLM 调用接口，**所有模型都通过 OneAPI 网关调用**，实现统一管理、灵活切换和故障转移。

## 🎯 核心特性

- ✅ **统一网关**: 所有模型通过 OneAPI 调用
- ✅ **多模型支持**: DeepSeek、Qwen、SiliconFlow 等
- ✅ **流式请求**: 支持流式输出和限流检测
- ✅ **向后兼容**: 保留所有旧的配置键名
- ✅ **类型安全**: 完整的 TypeScript 类型支持

## 🚀 快速开始

### 1. 环境配置

确保 `.env` 文件中配置了 OneAPI：

```env
# OneAPI 基础地址
ONEAPI_BASE_URL=http://localhost:3000/v1

# OneAPI API 密钥
ONEAPI_API_KEY=sk-your-token-here

# 默认模型
ONEAPI_MODEL=deepseek-chat
```

### 2. 基础使用

```typescript
import { createLLMClient } from '@/lib/llm-client'

// 使用默认模型 (DeepSeek Chat)
const client = createLLMClient()

const { content, duration } = await client.chat([
  { role: 'user', content: '你好' }
])

console.log(content)
console.log(`耗时: ${duration}ms`)
```

### 3. 使用不同模型

```typescript
// DeepSeek Chat (日常对话)
const deepseek = createLLMClient('deepseek_chat')

// DeepSeek Reasoner (复杂推理)
const reasoner = createLLMClient('deepseek_reasoner')

// DeepSeek V3.2 Pro (高级对话)
const v32pro = createLLMClient('deepseek_v32_pro')

// Qwen Max (阿里最强模型)
const qwen = createLLMClient('qwen_max')

// Qwen Flash (快速响应)
const flash = createLLMClient('qwen_flash')
```

## 📋 可用模型配置

### 主力模型 (推荐使用)

| 配置键 | 模型名称 | 用途 |
|--------|---------|------|
| `default` | DeepSeek Chat | 默认配置，日常对话 |
| `deepseek_chat` | DeepSeek Chat | 日常对话主力模型 |
| `deepseek_reasoner` | DeepSeek Reasoner | 复杂推理任务 |
| `deepseek_v32_pro` | DeepSeek V3.2 Pro | 高级对话模型 |
| `qwen_max` | Qwen Max | 阿里最强模型 |
| `qwen_flash` | Qwen Flash | 快速响应模型 |

### 兼容性别名 (向后兼容)

| 配置键 | 映射到 | 说明 |
|--------|--------|------|
| `oneapi` | `default` | 默认 OneAPI 配置 |
| `oneapi_deepseek` | `deepseek_chat` | DeepSeek Chat 别名 |
| `oneapi_deepseek_chat` | `deepseek_chat` | DeepSeek Chat 别名 |
| `oneapi_deepseek_reasoner` | `deepseek_reasoner` | Reasoner 别名 |
| `oneapi_qwen_max` | `qwen_max` | Qwen Max 别名 |
| `oneapi_qwen_flash` | `qwen_flash` | Qwen Flash 别名 |
| `oneapi_qwen_plus` | `qwen_max` | Qwen Plus 别名 |

## 💻 高级用法

### 流式请求

```typescript
const { content, metrics } = await client.chatStream(
  [{ role: 'user', content: '介绍一下你自己' }],
  {
    onEvent: (event) => {
      if (event.type === 'delta') {
        // 实时输出内容
        process.stdout.write(event.content)
      } else if (event.type === 'rate_limit') {
        // 检测到限流
        console.log('⚠️ 检测到限流:', event.info)
      }
    }
  }
)

console.log('\n指标:', metrics)
// {
//   totalDuration: 2500,
//   firstTokenTime: 500,
//   tokenCount: 150,
//   tokensPerSecond: 60,
//   rateLimitDetected: false,
//   rateLimitEvents: [],
//   avgChunkInterval: 16
// }
```

### 调整参数

```typescript
const { content } = await client.chat(
  [{ role: 'user', content: '写一首诗' }],
  {
    temperature: 0.8,    // 创造性 (0-1)
    maxTokens: 500,      // 最大 token 数
  }
)
```

### JSON 输出

```typescript
const { content } = await client.chat(
  [{ role: 'user', content: '返回一个JSON对象' }],
  {
    responseFormat: { type: 'json_object' }
  }
)

const data = JSON.parse(content)
```

### 多模型对比

```typescript
import { compareModels } from '@/lib/llm-client'

const results = await compareModels(
  '用一句话介绍人工智能',
  ['deepseek_chat', 'qwen_max', 'qwen_flash'],
  {
    useStream: true,
    temperature: 0.7,
    onProgress: (model, event) => {
      if (event.type === 'delta') {
        console.log(`[${model}] ${event.content}`)
      }
    }
  }
)

results.forEach(result => {
  console.log(`${result.model}: ${result.content}`)
  console.log(`耗时: ${result.duration}ms`)
})
```

## 🔧 模型选择建议

### 按场景选择

| 场景 | 推荐模型 | 理由 |
|------|---------|------|
| 日常对话 | `deepseek_chat` | 性价比高，响应快 |
| 复杂推理 | `deepseek_reasoner` | 推理能力强 |
| 高级对话 | `deepseek_v32_pro` | 能力最强 |
| 内容生成 | `qwen_max` | 创作能力强 |
| 快速响应 | `qwen_flash` | 速度最快 |

### 按成本选择

| 需求 | 推荐模型 |
|------|---------|
| 最低成本 | `qwen_flash` |
| 均衡选择 | `deepseek_chat` |
| 不计成本 | `deepseek_v32_pro` |

## 🛡️ 错误处理

```typescript
try {
  const client = createLLMClient('deepseek_chat')
  const { content } = await client.chat([
    { role: 'user', content: '你好' }
  ])
  console.log(content)
} catch (error: any) {
  if (error.message.includes('未配置 ONEAPI_API_KEY')) {
    console.error('请先配置 .env 文件中的 ONEAPI_API_KEY')
  } else if (error.message.includes('无可用渠道')) {
    console.error('请在 OneAPI 管理后台配置渠道')
  } else {
    console.error('调用失败:', error.message)
  }
}
```

## 📊 监控和调试

### 查看配置信息

```typescript
const client = createLLMClient('deepseek_chat')
const config = client.getConfig()

console.log('模型名称:', config.name)
console.log('模型 ID:', config.model)
console.log('Base URL:', config.baseURL)
console.log('超时时间:', config.timeout, 'ms')
```

### 检测限流

流式请求会自动检测限流：

```typescript
const { content, metrics } = await client.chatStream(
  [{ role: 'user', content: '长文本...' }]
)

if (metrics.rateLimitDetected) {
  console.warn('⚠️ 检测到限流!')
  console.warn('限流事件:', metrics.rateLimitEvents)
  console.warn('平均间隔:', metrics.avgChunkInterval, 'ms')
}
```

## 🔍 测试

运行测试脚本验证配置：

```bash
# 测试统一 OneAPI 配置
npx tsx scripts/test-unified-oneapi.ts

# 测试所有模型
npx tsx scripts/test-oneapi-setup.ts
```

## 📚 相关文档

- [OneAPI 渠道配置](./ONEAPI_CHANNELS_CONFIG.md)
- [OneAPI 迁移指南](./ONEAPI_MIGRATION.md)
- [测试脚本](../scripts/test-oneapi-setup.ts)
- [LLM 客户端源码](../lib/llm-client.ts)

## ❓ 常见问题

### Q: 为什么所有模型都通过 OneAPI？

A: 统一使用 OneAPI 网关的好处：
- **统一管理**: 在一个地方管理所有模型
- **灵活切换**: 修改环境变量即可切换模型
- **负载均衡**: 自动分配请求到多个渠道
- **故障转移**: 某个渠道失败时自动切换
- **统一监控**: 集中查看调用日志和用量

### Q: 旧代码还能用吗？

A: 可以！所有旧的配置键名（如 `oneapi_deepseek`）都保留了别名映射，向后兼容。

### Q: 如何切换到服务器上的 OneAPI？

A: 修改 `.env` 文件：

```env
# 从本地 OneAPI 切换到服务器 OneAPI
ONEAPI_BASE_URL=https://your-server.com/v1
ONEAPI_API_KEY=sk-your-server-token
```

代码不需要修改。

### Q: 如何添加新模型？

A: 两个步骤：

1. **在 OneAPI 管理后台添加渠道**：
   - 访问 http://localhost:3000
   - 进入"渠道" → "新建渠道"
   - 配置模型信息

2. **在 `llm-client.ts` 中添加配置**：
   ```typescript
   new_model: {
     name: 'OneAPI - New Model',
     apiKey: oneAPIKey,
     baseURL: oneAPIBaseURL,
     model: process.env.ONEAPI_MODEL_NEW || 'new-model',
     timeout: 5 * 60 * 1000,
   }
   ```

### Q: 为什么默认模型是 `default` 而不是 `oneapi`？

A: 为了更清晰的语义。`default` 表示默认配置，`oneapi` 保留为别名以保持向后兼容。两者完全相同。
