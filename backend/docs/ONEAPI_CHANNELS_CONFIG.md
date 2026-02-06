# OneAPI 渠道配置指南

本指南详细说明如何在 OneAPI 中配置模型渠道。

## 📋 已配置的模型

| 模型 | 类型 | 用途 |
|------|------|------|
| deepseek-chat | DeepSeek Chat | 日常对话主力模型 |
| deepseek-reasoner | DeepSeek Reasoner | 复杂推理任务 |
| Pro/deepseek-ai/DeepSeek-V3.2 | SiliconFlow V3.2 Pro | 高级对话模型 |
| qwen-max | Qwen Max | 阿里最强模型 |
| qwen-flash | Qwen Flash | 快速响应模型 |

## 🚀 配置步骤

### 1. 访问 OneAPI 管理后台

浏览器访问: http://localhost:3000

### 2. 登录管理员账号

- 用户名: `root`
- 密码: `123456`

> ⚠️ 首次登录后请立即修改密码！

### 3. 添加渠道

进入左侧菜单 **"渠道"** → 点击 **"新建渠道"**

#### 渠道 1: DeepSeek Chat

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `DeepSeek-Chat` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://api.deepseek.com/v1` |
| 密钥 | `sk-your-deepseek-api-key-here` |
| 模型映射 | `deepseek-chat` |
| 重定向 | ❌ 取消勾选 |
| 状态 | ✅ 启用 |

#### 渠道 2: DeepSeek Reasoner

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `DeepSeek-Reasoner` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://api.deepseek.com/v1` |
| 密钥 | `sk-your-deepseek-api-key-here` |
| 模型映射 | `deepseek-reasoner` |
| 重定向 | ❌ 取消勾选 |
| 状态 | ✅ 启用 |

#### 渠道 3: Qwen Max

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `Qwen-Max` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 密钥 | `sk-your-dashscope-api-key-here` |
| 模型映射 | `qwen-max` |
| 重定向 | ❌ 取消勾选 |
| 状态 | ✅ 启用 |

#### 渠道 4: Qwen Flash

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `Qwen-Flash` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 密钥 | `sk-your-dashscope-api-key-here` |
| 模型映射 | `qwen-flash` |
| 重定向 | ❌ 取消勾选 |
| 状态 | ✅ 启用 |

#### 渠道 5: SiliconFlow DeepSeek V3.2 Pro

| 配置项 | 值 |
|--------|-----|
| 渠道名称 | `SiliconFlow-DeepSeek-V3.2` |
| 渠道类型 | `OpenAI` |
| Base URL | `https://api.siliconflow.cn/v1` |
| 密钥 | `sk-your-siliconflow-api-key-here` |
| 模型映射 | `Pro/deepseek-ai/DeepSeek-V3.2` |
| 重定向 | ❌ 取消勾选 |
| 状态 | ✅ 启用 |

### 4. 创建访问令牌

1. 进入左侧菜单 **"令牌"**
2. 点击 **"新建令牌"**
3. 配置令牌：
   - **名称**: `context-os-dev`
   - **额度**: `500000` (50万 tokens)
   - **过期时间**: (可选)
   - **模型权限**: 选择需要暴露的模型，或选择"全部"
4. 点击 **"提交"**
5. **复制生成的令牌** (格式: `sk-xxxxx`)
   > ⚠️ 令牌只会显示一次，请立即复制保存！

### 5. 配置环境变量

编辑项目根目录的 `.env` 文件：

```bash
# 复制模板
cp .env.example .env

# 编辑 .env
nano .env
```

填写以下配置：

```env
# OneAPI 基础地址
ONEAPI_BASE_URL=http://localhost:3000/v1

# OneAPI API 密钥 (刚才创建的令牌)
ONEAPI_API_KEY=sk-你的令牌

# 默认模型
ONEAPI_MODEL=deepseek-chat
```

### 6. 测试配置

运行测试脚本：

```bash
npx tsx scripts/test-oneapi-setup.ts
```

如果配置正确，你会看到所有测试都通过。

## 💻 代码使用示例

### 基础使用

```typescript
import { createLLMClient } from '@/lib/llm-client'

// 使用默认模型 (deepseek-chat)
const client = createLLMClient('oneapi')

const { content } = await client.chat([
  { role: 'user', content: '你好' }
])
```

### 使用不同模型

```typescript
// DeepSeek Chat (主力模型)
const deepseekChat = createLLMClient('oneapi_deepseek_chat')

// DeepSeek Reasoner (推理模型，适合复杂任务)
const deepseekReasoner = createLLMClient('oneapi_deepseek_reasoner')

// SiliconFlow DeepSeek V3.2 Pro (高级模型)
const deepseekV32Pro = createLLMClient('oneapi_deepseek_v32_pro')

// Qwen Max (阿里最强模型)
const qwenMax = createLLMClient('oneapi_qwen_max')

// Qwen Flash (快速响应)
const qwenFlash = createLLMClient('oneapi_qwen_flash')
```

### 模型选择建议

| 场景 | 推荐模型 | 配置键 |
|------|---------|--------|
| 日常对话 | DeepSeek Chat | `oneapi_deepseek_chat` |
| 复杂推理 | DeepSeek Reasoner | `oneapi_deepseek_reasoner` |
| 高级对话 | DeepSeek V3.2 Pro | `oneapi_deepseek_v32_pro` |
| 内容生成 | Qwen Max | `oneapi_qwen_max` |
| 快速响应 | Qwen Flash | `oneapi_qwen_flash` |

## 🔍 验证配置

### 1. 检查渠道状态

在 OneAPI 管理后台的 **"渠道"** 页面，检查：
- ✅ 所有渠道的状态都是 **"启用"**
- ✅ 没有错误提示

### 2. 测试单个渠道

点击渠道右侧的 **"测试"** 按钮，查看是否能正常调用。

### 3. 查看使用日志

进入 **"使用日志"** 页面，可以看到：
- 调用时间
- 使用的模型
- 消耗的 token 数量
- 调用状态

## ❓ 常见问题

### Q: 为什么调用返回 401 错误？

A: 检查以下几点：
1. `.env` 中的 `ONEAPI_API_KEY` 是否正确
2. OneAPI 令牌是否有效（未过期、未超出额度）
3. 令牌是否有该模型的使用权限

### Q: 为什么调用返回 "模型不可用"？

A: 检查：
1. OneAPI 渠道中的模型映射是否正确
2. 渠道是否启用
3. 上游 API 的 Key 是否有效

### Q: 如何查看实际调用了哪个渠道？

A: 在 OneAPI 管理后台的 **"使用日志"** 中查看详细记录。

### Q: 如何配置负载均衡？

A: OneAPI 会自动在所有启用的渠道间分配请求。如需手动控制：
1. 为每个渠道设置不同的 **"权重"**
2. 设置 **"最大并发数"** 限制单个渠道的并发

## 📚 相关文档

- [快速开始指南](./ONEAPI_MIGRATION.md)
- [详细配置指南](./ONEAPI_SETUP.md)
- [测试脚本](../scripts/test-oneapi-setup.ts)
- [LLM 客户端代码](../lib/llm-client.ts)
