# 阿里云部署指南 - MNS + 函数计算架构

本文档指导你在阿里云上部署 Context OS 的文档处理系统。

## 架构概述

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Next.js API   │──────│      MNS        │──────│  Function Compute│
│  (用户端)        │      │   (消息队列)     │      │   (文档处理)     │
└─────────────────┘      └─────────────────┘      └────────┬────────┘
                                                             │
                                                             ▼
                                                      ┌─────────────┐
                                                      │   Qdrant    │
                                                      │  (向量数据库) │
                                                      └─────────────┘
```

## 部署步骤

### 第一步：购买阿里云服务

#### 1.1 消息服务 MNS

- **产品**: 消息服务 Message Service
- **规格**: 标准版
- **区域**: 建议选择与用户接近的区域（如 cn-hangzhou）
- **预估费用**: ¥10-30/月

购买链接: https://www.aliyun.com/product/mns

#### 1.2 函数计算 Function Compute

- **产品**: 函数计算 Function Compute 3.0
- **规格**: 按量付费
- **预估费用**:
  - 调用次数: ¥1/百万次
  - 执行时间: ¥0.00003167/GB*秒

购买链接: https://www.aliyun.com/product/fc

#### 1.3 Qdrant 自托管

在你的 ECS 上部署 Qdrant（Docker 方式）。

### 第二步：创建 MNS 队列

#### 2.1 登录阿里云控制台

进入 [消息服务 MNS 控制台](https://mns.console.aliyun.com/)

#### 2.2 创建队列

1. 点击 "队列列表"
2. 点击 "创建队列"
3. 配置参数：

| 参数 | 值 | 说明 |
|-----|-----|------|
| 队列名称 | `context-os-doc-process` | 文档处理队列 |
| 消息最大长度 | 65536 | 默认值 |
| 消息可见性超时 | 300 | 5分钟，处理超时时间 |
| 消息保留时长 | 3 | 天 |
| 长轮询 | 30 | 秒，减少空请求 |
| 消息可见性超时 | 300 | 秒 |

#### 2.3 获取访问密钥

1. 进入 [AccessKey 管理](https://ram.console.aliyun.com/manage/ak)
2. 创建 AccessKey
3. 保存 `AccessKeyId` 和 `AccessKeySecret`

### 第三步：创建函数计算服务

#### 3.1 创建服务

1. 进入 [函数计算 FC 控制台](https://fc.console.aliyun.com/)
2. 创建服务，命名为 `context-os`

#### 3.2 创建函数

1. 点击 "创建函数"
2. 选择 "使用内置运行时创建"
3. 配置:

| 参数 | 值 |
|-----|-----|
| 函数名称 | `document-processor` |
| 运行时 | `Node.js 20` |
| 函数代码 | 通过 ZIP 上传 (后续配置) |
| 内存规格 | 1024 MB |
| 超时时间 | 600 秒 (10分钟) |
| 实例并发度 | 10 |

#### 3.3 配置环境变量

在函数配置中添加环境变量：

| 变量名 | 说明 | 示例值 |
|-------|------|--------|
| `SUPABASE_URL` | Supabase URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase Service Key | `eyJ...` |
| `QDRANT_URL` | Qdrant 地址 | `http://your-ecs:6333` |
| `EMBEDDING_MODEL` | 嵌入模型 | `BAAI/bge-m3` |
| `ONEAPI_BASE_URL` | OneAPI 地址 | `https://your-oneapi` |
| `ONEAPI_KEY` | OneAPI 密钥 | `sk-...` |

#### 3.4 配置 VPC 访问

如果 Qdrant 和 Supabase 在内网：
1. 为函数配置 VPC
2. 添加安全组规则允许访问 Qdrant 和 Supabase

#### 3.5 配置 MNS 触发器

1. 进入函数 "触发器管理"
2. 添加触发器：
   - 触发器类型: MNS 队列
   - 队列名称: `context-os-doc-process`
   - 批量拉取: 5
   - 并发消费: 10

### 第四步：部署函数代码

#### 4.1 准备部署包

```bash
# 安装依赖
npm install --production

# 打包
zip -r function.zip . -x "*.test.ts" "*.map"
```

#### 4.2 上传代码

1. 在函数控制台，进入 "代码" 页签
2. 上传 `function.zip`
3. 配置处理函数: `index.handler`

#### 4.3 函数入口示例

```typescript
// index.ts
import { processDocument } from './lib/worker-three-layer'

export async function handler(event) {
  // MNS 消息格式
  const messages = JSON.parse(event.body || '{}')
  const results = []

  for (const msg of messages) {
    const body = JSON.parse(msg.MessageBody)
    try {
      const result = await processDocument({ data: body })
      results.push({ messageId: msg.MessageId, success: true, result })
    } catch (error) {
      results.push({ messageId: msg.MessageId, success: false, error: error.message })
    }
  }

  return { results }
}
```

### 第五步：配置 Next.js API

#### 5.1 添加 MNS 依赖

```bash
npm install @alicloud/mns-2015-06-06
# 或使用我们封装的 lib/mns.ts
```

#### 5.2 修改上传 API

```typescript
// app/api/documents/route.ts
import { getMNSClient } from '@/lib/mns'

export async function POST(req: NextRequest) {
  // ... 保存文件到 Supabase Storage

  // 发送 MNS 消息
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

#### 5.3 环境变量配置

添加到 `.env.local`:

```bash
# MNS 配置
MNS_ACCOUNT_ID=你的AccountID
MNS_REGION=cn-hangzhou
MNS_ACCESS_KEY_ID=你的AccessKeyId
MNS_ACCESS_KEY_SECRET=你的AccessKeySecret
MNS_QUEUE_PREFIX=context-os

# 使用云函数处理
USE_CLOUD_FUNCTION=true
```

### 第六步：配置进度推送

#### 6.1 方案：HTTP 回调

云函数处理完成时，调用 Next.js API 更新状态：

```typescript
// 在云函数中处理完成后
await fetch(`${process.env.CALLBACK_BASE_URL}/api/callback/document`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doc_id,
    status: 'completed',
    result: { chunks_count: points.length }
  })
})
```

#### 6.2 方案：轮询查询

前端定期查询文档状态：

```typescript
// 前端代码
const checkStatus = async (docId: string) => {
  const response = await fetch(`/api/documents/${docId}`)
  const { status, progress } = await response.json()
  // 更新 UI
}
```

### 第七步：安全配置

#### 7.1 RAM 权限配置

创建 RAM 角色，授予函数计算最小权限：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mns:SendMessage",
        "mns:ReceiveMessage",
        "mns:DeleteMessage"
      ],
      "Resource": "acs:mns:*:*:queues/context-os-*"
    },
    {
      "Effect": "Allow",
      "Action": ["log:WriteLogs"],
      "Resource": "*"
    }
  ]
}
```

#### 7.2 网络隔离

- 函数计算使用 VPC
- 只允许访问内网 Qdrant 和 Supabase
- 禁止公网访问（除了回调 API）

### 第八步：监控和告警

#### 8.1 函数计算监控

- 设置内存使用率告警 (>80%)
- 设置错误率告警 (>5%)
- 设置超时告警

#### 8.2 MNS 监控

- 监控消息堆积数量
- 设置死信队列告警

## 成本估算

假设：1000 用户，每用户每天处理 10 个文档

| 项目 | 规格 | 用量 | 月费用 |
|-----|------|------|--------|
| MNS | 标准版 | 30万请求 | ¥10 |
| 函数计算 | 1GB, 100s | 30万次 | ¥100 |
| 函数计算 | 1GB, 100s | 300万GB*秒 | ¥95 |
| **总计** | | | **~¥200/月** |

## 故障排查

### 问题：函数超时

- 检查文档大小，超过 10MB 需要异步处理
- 增加超时时间
- 考虑使用 GPU 实例加速嵌入

### 问题：消息堆积

- 增加函数并发度
- 增加实例数量
- 检查是否有死循环

### 问题：内存不足

- 增加内存规格
- 优化 K-Type 处理逻辑
- 使用流式处理大文件

## 下一步

部署完成后，你可以：
1. 测试文档上传和处理流程
2. 配置 CI/CD 自动部署
3. 添加更多函数（如 Rerank、摘要生成）
