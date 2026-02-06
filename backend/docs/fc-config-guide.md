# 函数计算配置指南

本文档说明如何配置和部署阿里云函数计算的 `document-processor` 函数。

## 快速开始

### 1. 构建部署包

```bash
# 在项目根目录执行
npm run build:fc

# 或直接运行
tsx scripts/build-fc-function.ts
```

构建完成后，会生成 `functions/document-processor/function.zip`

### 2. 在阿里云控制台创建函数

1. 登录 [函数计算 FC 控制台](https://fc.console.aliyun.com/)
2. 选择区域（建议与用户接近）
3. 创建服务：`context-os`
4. 创建函数：`document-processor`

### 3. 上传代码

1. 进入函数详情页
2. 点击 "代码" 标签
3. 选择 "上传 ZIP 包"
4. 上传 `function.zip`

### 4. 配置函数

#### 基础配置

| 配置项 | 值 |
|-------|-----|
| 运行时 | Node.js 20 |
| 入口 | `index.handler` |
| 内存规格 | 1024 MB (可调整到 2048 MB) |
| 超时时间 | 600 秒 |
| 实例并发度 | 10 |

#### 环境变量

在 "配置" -> "环境变量" 中添加：

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Qdrant
QDRANT_URL=http://your-ecs-ip:6333

# Embedding
EMBEDDING_MODEL=BAAI/bge-m3

# OneAPI (用于 LLM 调用)
ONEAPI_BASE_URL=https://your-oneapi.com
ONEAPI_KEY=sk-...

# 可选: 回调 URL (用于通知处理完成)
CALLBACK_BASE_URL=https://your-nextjs-app.com
```

### 5. 配置 MNS 触发器

1. 进入 "触发器管理" 标签
2. 添加触发器：
   - 类型: MNS 队列
   - 队列名称: `context-os-doc-process`
   - 批量拉取: 5
   - 并发消费: 10

## 函数结构

```
functions/document-processor/
├── index.ts           # 函数入口 (handler)
├── worker.ts          # 文档处理逻辑
├── types.ts           # 类型定义
├── tsconfig.json      # TypeScript 配置
├── package.json       # 依赖配置
└── lib/               # 从主项目复制的库文件
    ├── embedding.ts
    ├── parsers/
    ├── chunkers/
    ├── processors/
    ├── oneapi.ts
    └── qdrant.ts
```

## 测试函数

### 本地测试

```bash
cd functions/document-processor
npm run build
node dist/index.js
```

### 在线测试

在函数控制台的 "测试函数" 中，输入测试事件：

```json
{
  "messages": [
    {
      "messageId": "test-001",
      "body": "{\"doc_id\":\"test-doc-001\",\"storage_path\":\"test.pdf\",\"kb_id\":\"test-kb\",\"user_id\":\"test-user\"}"
    }
  ]
}
```

## 监控和日志

### 查看日志

1. 进入 "日志查询" 标签
2. 可以查看函数执行日志

### 监控指标

- 调用次数
- 平均执行时间
- 错误率
- 内存使用

## 常见问题

### Q: 函数超时怎么办？

A: 大文档处理可能超过 10 分钟。考虑：
1. 增加超时时间
2. 减小文档大小限制
3. 使用异步处理 + 轮询状态

### Q: 内存不足？

A: 增加内存规格到 2048 MB 或更高

### Q: 如何更新函数？

A: 重新构建并上传 ZIP 包：

```bash
tsx scripts/build-fc-function.ts
# 然后在控制台上传新的 function.zip
```

## 与 Next.js 集成

### 发送消息到 MNS

```typescript
// app/api/documents/route.ts
import { getMNSClient } from '@/lib/mns'

export async function POST(req: NextRequest) {
  // ... 保存文件到 Supabase Storage

  // 发送处理任务
  const mns = getMNSClient()
  await mns.sendMessage('doc-process', {
    body: {
      doc_id: newDocId,
      storage_path: filePath,
      kb_id,
      user_id,
    }
  })

  return NextResponse.json({ documentId: newDocId })
}
```

### 接收回调

```typescript
// app/api/callback/document/route.ts
export async function POST(req: NextRequest) {
  const { doc_id, status, result } = await req.json()

  // 更新数据库状态
  await supabase.from('documents')
    .update({ status, ...result })
    .eq('id', doc_id)

  // 通知前端 (通过 SSE 或 WebSocket)
  await publishProgress(doc_id, status === 'completed' ? 'completed' : 'failed')

  return NextResponse.json({ success: true })
}
```
