# Sprint 0: 基础设施

> **目标**: 建立流式对话、LLM 集成、引用系统的技术基础
> **周期**: 2-3 天
> **依赖**: 无

## 概述

在构建核心对话体验之前，需要先建立三个基础设施：
1. **SSE (Server-Sent Events)** - 用于流式响应
2. **SiliconFlow LLM 集成** - DeepSeek V3 Pro API
3. **Citation 组件** - 引用展示与交互

---

## 任务 0.1: SSE 基础设施

### 描述
建立 Server-Sent Events 的服务端和客户端支持，实现流式数据传输。

### 技术方案

#### 服务端 (App Router)
```typescript
// app/api/chat/stream/route.ts
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 发送 token
      send({ type: 'token', content: '...' });

      // 发送引用
      send({ type: 'citation', index: 1, content: '...' });

      // 结束
      send({ type: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### 客户端 Hook
```typescript
// hooks/useSSEChat.ts
export function useSSEChat() {
  const [content, setContent] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);

  const sendMessage = async (message: string) => {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // 解析 SSE 格式
      parseSSE(chunk, (data) => {
        if (data.type === 'token') setContent(prev => prev + data.content);
        if (data.type === 'citation') setCitations(prev => [...prev, data]);
      });
    }
  };

  return { content, citations, sendMessage };
}
```

### 验收标准
- [ ] SSE 连接建立成功
- [ ] 流式数据正确接收和渲染
- [ ] 连接异常时正确处理
- [ ] 支持手动取消请求

### 文件清单
```
lib/sse/
  ├── stream-builder.ts    # SSE 流构建工具
  └── event-emitter.ts      # 事件发射器
hooks/
  └── useSSEStream.ts       # SSE 客户端 Hook
```

---

## 任务 0.2: SiliconFlow LLM 集成

### 描述
封装 SiliconFlow API，提供统一的 LLM 调用接口。

### API 配置
```env
# SiliconFlow (DeepSeek V3 Pro)
SILICONFLOW_API_KEY=sk-xxx
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3
```

### 技术方案

#### LLM 客户端
```typescript
// lib/llm/siliconflow.ts
import { createOpenAI } from '@ai-sdk/openai';

const siliconflow = createOpenAI({
  baseURL: process.env.SILICONFLOW_BASE_URL,
  apiKey: process.env.SILICONFLOW_API_KEY,
});

export async function chatCompletion(params: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}) {
  return siliconflow.chat.completions.create({
    model: process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3',
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 4096,
    stream: params.stream ?? false,
  });
}

// 流式版本
export async function streamChatCompletion(params: {
  messages: Array<{ role: string; content: string }>;
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}) {
  const stream = await chatCompletion({ ...params, stream: true });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || '';
    if (token) params.onToken(token);
  }
  params.onDone();
}
```

#### Verbose AI SDK 集成（可选）
如果需要更好的流式处理体验：
```typescript
import { streamText } from 'ai';

export function generateResponse(messages: Message[]) {
  return streamText({
    model: siliconflow(process.env.SILICONFLOW_MODEL!),
    messages,
  });
}
```

### 验收标准
- [ ] 能成功调用 SiliconFlow API
- [ ] 支持流式和非流式两种模式
- [ ] 正确处理 API 错误和限流
- [ ] 单元测试覆盖核心逻辑

### 文件清单
```
lib/llm/
  ├── siliconflow.ts         # SiliconFlow 客户端
  ├── types.ts                # LLM 相关类型定义
  └── prompt-templates.ts     # 提示词模板（后续）
```

---

## 任务 0.3: Citation 组件

### 描述
实现引用展示组件，支持上标数字 + Tooltip 悬浮卡片。

### 设计规范

#### 视觉设计
```
引用标记：右上标蓝色数字
          ① ② ③ ④...

Tooltip 卡片：
┌─────────────────────────────────┐
│ 📄 引用 [1]                      │
│ ─────────────────────────────  │
│ 本文介绍了 Context OS 的产品...  │
│                                 │
│ 来源: Context OS PRD.md         │
│ 相关度: 0.92                     │
└─────────────────────────────────┘
```

#### 组件 API
```typescript
interface CitationProps {
  index: number;
  content: string;
  source: {
    docId: string;
    docName: string;
    chunkIndex?: number;
  };
  score?: number;
}
```

### 技术方案

#### Citation 组件
```typescript
// components/chat/Citation.tsx
'use client'

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

export function Citation({ index, content, source, score }: CitationProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Badge
          variant="outline"
          className="ml-1 h-4 min-w-4 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer text-xs"
        >
          {index}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="top">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">引用 [{index}]</span>
            {score && (
              <span className="text-xs text-muted-foreground">
                {Math.round(score * 100)}%
              </span>
            )}
          </div>
          <Separator />
          <p className="text-sm line-clamp-4">{content}</p>
          <Separator />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span className="truncate">{source.docName}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
```

#### 消息渲染器
```typescript
// components/chat/Message.tsx
interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export function MessageRenderer({ message }: { message: Message }) {
  const [content, embeddedCitations] = parseCitations(message);

  return (
    <div className="prose prose-sm max-w-none">
      <p>{content}</p>
      {embeddedCitations.map((cit, i) => (
        <Citation key={i} {...cit} />
      ))}
    </div>
  );
}

function parseCitations(message: Message): [string, Citation[]] {
  // 解析 content 中的引用标记
  // 例如: "...产品愿景¹..." → 提取引用位置
  // ...
}
```

### 验收标准
- [ ] 引用标记显示为右上标数字
- [ ] 鼠标悬停显示内容卡片
- [ ] 卡片显示文档来源和相关度
- [ ] 支持点击跳转到原文位置

### 文件清单
```
components/chat/
  ├── Citation.tsx             # 引用标记组件
  ├── CitationCard.tsx         # 引用卡片内容
  ├── Message.tsx              # 消息渲染器
  └── message-parser.ts        # 消息解析（注入引用标记）
```

---

## 依赖关系

```
任务 0.1 (SSE)
    ↓
任务 0.2 (LLM) ──→ 任务 0.3 (Citation)
```

## 完成标准

Sprint 0 完成当：
- [ ] 所有单元测试通过
- [ ] SSE 流式传输 Demo 可运行
- [ ] LLM API 调用成功
- [ ] Citation 组件在 Storybook 中展示

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SiliconFlow API 变化 | 中 | 封装接口层，便于切换 |
| SSE 兼容性问题 | 低 | 添加 EventSource polyfill |
| 引用解析复杂度 | 中 | 使用标记语言简化解析 |
