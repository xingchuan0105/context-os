# Sprint 1: 核心对话体验

> **目标**: 实现完整的多轮对话功能，建立 Notebook 的核心交互界面
> **周期**: 3-5 天
> **依赖**: Sprint 0 完成

## 概述

Sprint 1 是��品的核心体验，实现：
1. **Chat 页面** - 三栏布局的对话界面
2. **多轮对话管理** - Session 存储与上下文传递
3. **RAG 检索集成** - 搜索 + LLM 生成完整链路
4. **流式响应** - 实时显示 AI 思考过程

---

## 任务 1.1: Chat 页面框架

### 描述
创建 Chat 页面的三栏布局：历史会话 | 对话区 | 笔记预览

### 布局设计

```
┌────────────────────────────────────────────────────────────────┐
│  Context OS                  [Knowledge Base Name]    [用户]   │
├──────────────┬───────────────────────────────────┬─────────────┤
│              │                                   │             │
│ ▼ 对话历史   │         Chat Area                 │  Notes      │
│ ┌──────────┐│  ┌─────────────────────────────┐  │  Preview    │
│ │对话1     ││  │ User: 这篇文档讲了什么？     │  │  ┌───────┐  │
│ │对话2     ││  │                             │  │  │ 笔记1 │  │
│ │对话3     ││  │ AI: 本文介绍了 Context OS ¹ │  │  │       │  │
│ └──────────┘│  │ 它采用混合架构²来解决...     │  │  └───────┘  │
│ [+ 新建]    │  │                             │  │  ┌───────┐  │
│              │  │ [New Message_____________] │  │  │ 笔记2 │  │
│ ▲ 文件源     │  │ [Send]                     │  │  │       │  │
│ ┌──────────┐│  ┌─────────────────────────────┐  │  └───────┘  │
│ │☑ 文档A   ││  │ 📝 快速笔记                │  │  [+ 保存]   │
│ │☐ 文档B   ││  │ 从对话中保存想法...        │  │             │
│ │☑ 文档C   ││  └─────────────────────────────┘  │             │
│ │☐ 文档D   ││                                   │             │
│ └──────────┘│                                   │             │
│ [+ 添加]    │                                   │             │
└──────────────┴───────────────────────────────────┴─────────────┘

说明：
- 左侧边栏分为上下两部分，可独立折叠/展开
- 上半部分：对话历史清单
- 下半部分：文件源清单，支持勾选（☑=已选，☐=未选）
- 只有勾选的源在对话时才会被检索
- 两部分都有折叠按钮（▼/▲）
```

### 技术方案

#### 页面结构
```typescript
// app/kb/[id]/chat/page.tsx
export default function ChatPage() {
  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* 左侧：历史会话 + 文件源 */}
        <LeftSidebar>
          <CollapsibleSection defaultExpanded>
            <ChatHistoryList />
          </CollapsibleSection>
          <CollapsibleSection defaultExpanded>
            <DocumentSourceList />
          </CollapsibleSection>
        </LeftSidebar>

        {/* 中间：对话区 */}
        <ChatArea />

        {/* 右侧：笔记预览 */}
        <NotesPreviewSidebar />
      </div>
    </AppShell>
  );
}
```

#### 组件拆分
```
app/kb/[id]/chat/
  ├── page.tsx                        # 主页面
  └── components/
      ├── LeftSidebar.tsx                 # 左侧边栏容器
      │   ├── CollapsibleSection.tsx      # 可折叠区域组件
      │   ├── ChatHistoryList.tsx         # 对话历史清单
      │   └── DocumentSourceList.tsx      # 文件源清单
      │       ├── SourceItem.tsx          # 单个源项（含勾选框）
      │       └── AddSourceDialog.tsx     # 添加源对话框
      ├── ChatArea.tsx                     # 对话主区域
      │   ├── MessageList.tsx              # 消息列表
      │   ├── MessageInput.tsx             # 输入框
      │   └── QuickNote.tsx                # 快速笔记区
      └── NotesPreviewSidebar.tsx          # 笔记预览侧边栏
```

### 验收标准
- [ ] 三栏布局响应式适配
- [ ] 历史会话列表显示与切换
- [ ] 文件源清单显示、添加、删除
- [ ] 文件源勾选/取消勾选状态���换
- [ ] 对话历史和文件源两部分独立折叠
- [ ] 输入框支持多行输入
- [ ] 移动端布局折叠处理

---

## 任务 1.2: 多轮对话管理

### 描述
建立对话会话的存储和状态管理，支持上下文传递。

### 数据模型扩展

#### 数据库 Schema
```sql
-- chat_sessions 已有，需要补充
ALTER TABLE chat_sessions ADD COLUMN kb_id TEXT;
ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 新增：会话摘要（可选）
ALTER TABLE chat_sessions ADD COLUMN summary TEXT;
```

#### 类型定义
```typescript
// lib/types/chat.ts
export interface ChatSession {
  id: string;
  kbId: string;
  userId: string;
  title: string;        // 自动生成或用户编辑
  summary?: string;     // AI 生成的会话摘要
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  createdAt: string;
}

export interface Citation {
  index: number;
  content: string;
  docId: string;
  docName: string;
  chunkIndex?: number;
  score?: number;
  metadata?: Record<string, any>;
}
```

### 状态管理
```typescript
// lib/stores/chat-store.ts
interface ChatStore {
  // 当前会话
  currentSession: ChatSession | null;
  messages: ChatMessage[];

  // 会话列表
  sessions: ChatSession[];

  // 操作
  createSession: (kbId: string) => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
}
```

### API 端点
```
GET  /api/chat/sessions?kb_id=xxx    # 获取会话列表
POST /api/chat/sessions                # 创建新会话
GET   /api/chat/sessions/:id          # 获取会话详情
DELETE /api/chat/sessions/:id          # 删除会话

GET  /api/chat/sessions/:id/messages  # 获取消息列表
POST /api/chat/sessions/:id/messages  # 发送消息
```

### 验收标准
- [ ] 会话自动创建和切换
- [ ] 消息按时间顺序渲染
- [ ] 会话标题自动生成（首条消息摘要）
- [ ] 支持会话重命名和删除

---

## 任务 1.3: RAG 检索集成

### 描述
实现完整的 RAG 链路：用户查询 → 向量检索 → LLM 生成 → 引用注入

### 技术方案

#### Chat API 完整流程
```typescript
// app/api/chat/sessions/[id]/messages/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { message, selectedSourceIds } = await req.json();
  const user = await getCurrentUser();

  // 1. 获取会话历史（用于上下文）
  const history = await getSessionMessages(params.id, 10);

  // 2. 向量检索（仅在勾选的源中检索）
  const queryVector = await embedQuery(message);

  // 如果没有勾选任何源，则检索整个知识库
  // 否则只在勾选的文档中检索
  const searchResults = await searchInKb(
    user.id,
    kbId,
    queryVector,
    {
      limit: 5,
      scoreThreshold: 0.5,
      documentIds: selectedSourceIds?.length > 0 ? selectedSourceIds : undefined,
    }
  );

  // 3. 构建提示词
  const prompt = buildRAGPrompt(message, searchResults);

  // 4. LLM 流式生成
  const stream = await streamChatCompletion({
    messages: [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: prompt }
    ],
    onToken: (token) => sendToken(token),
    onCitation: (index, source) => sendCitation(index, source),
  });

  // 5. 保存消息
  await saveMessage(params.id, {
    role: 'user',
    content: message,
  });

  await saveMessage(params.id, {
    role: 'assistant',
    content: fullContent,
    citations: searchResults,
  });

  return new Response(stream);
}
```

#### 文件源状态管理
```typescript
// lib/stores/document-source-store.ts
interface DocumentSourceStore {
  // 当前会话选中的源 ID 列表
  selectedSourceIds: Set<string>;

  // 操作
  toggleSource: (sourceId: string) => void;
  selectMultiple: (sourceIds: string[]) => void;
  clearSelection: () => void;
  isSelected: (sourceId: string) => boolean;

  // 获取当前选中的源列表（用于发送到后端）
  getSelectedIds: () => string[];
}
```

#### 引用注入算法
```typescript
// lib/chat/citation-injector.ts
export function injectCitations(
  response: string,
  sources: SearchResult[]
): { content: string; citations: Citation[] } {
  const citations: Citation[] = [];
  let content = response;
  let index = 1;

  // 简单策略：在句子末尾检测引用机会
  // 更高级的做法是让 LLM 直接输出引用标记

  for (const source of sources) {
    // 检测来源内容在回复中的出现位置
    const matches = findContentMatches(response, source.content);

    for (const match of matches) {
      const citationMark = String.fromCharCode(¹⁰⁰⁰ + index - 1); // ①②③...
      content = injectAtPosition(content, match.end, citationMark);

      citations.push({
        index,
        content: source.content,
        docId: source.docId,
        docName: source.docName,
        score: source.score,
      });

      index++;
    }
  }

  return { content, citations };
}
```

### 验收标准
- [ ] 查询返回相关检索���果
- [ ] 勾选的源被用于检索，未勾选的源不参与检索
- [ ] 未勾选任何源时，检索整个知识库
- [ ] LLM 回复基于检索内容
- [ ] 引用正确标记在回复中
- [ ] 悬停显示引用来源

---

## 任务 1.4: 流式响应

### 描述
实现实时的流式响应，让用户看到 AI "思考" 的过程。

### 技术方案

#### 服务端流式处理
```typescript
// lib/chat/stream-handler.ts
export async function handleChatStream(params: {
  sessionId: string;
  message: string;
  kbId: string;
  onToken: (token: string) => void;
  onCitation: (citation: Citation) => void;
  onDone: (fullContent: string) => void;
}) {
  const { sessionId, message, kbId } = params;

  // 1. 发送用户消息确认
  sendEvent('user', { content: message });

  // 2. 检索（阻塞但快速）
  const searchResults = await performSearch(message, kbId);
  sendEvent('search', { count: searchResults.length });

  // 3. LLM 生成（流式）
  let fullContent = '';
  const citations: Citation[] = [];

  await streamLLM({
    prompt: buildPrompt(message, searchResults),
    onToken: (token) => {
      fullContent += token;
      sendEvent('token', { content: token });
    },
  });

  // 4. 注入引用
  const { content: finalContent, citations: finalCitations } =
    injectCitations(fullContent, searchResults);

  // 5. 发送最终结果
  sendEvent('done', {
    content: finalContent,
    citations: finalCitations,
  });

  // 6. 保存到数据库
  await saveMessage(sessionId, {
    role: 'assistant',
    content: finalContent,
    citations: finalCitations,
  });
}

function sendEvent(type: string, data: any) {
  // SSE 格式
}
```

#### 客户端流式接收
```typescript
// hooks/useChatStream.ts
export function useChatStream(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (content: string) => {
    setIsStreaming(true);

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content }]);

    // 创建 AI 消息占位符
    const aiMessageId = Date.now();
    setMessages(prev => [...prev, {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      citations: [],
    }]);

    // 建立流式连接
    const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const data = JSON.parse(line.slice(6));
        handleStreamEvent(data, aiMessageId);
      }
    }

    setIsStreaming(false);
  };

  const handleStreamEvent = (data: any, messageId: number) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;

      switch (data.type) {
        case 'token':
          return { ...msg, content: msg.content + data.content };
        case 'citation':
          return { ...msg, citations: [...(msg.citations || []), data.citation] };
        case 'done':
          return { ...msg, content: data.content, citations: data.citations };
        default:
          return msg;
      }
    }));
  };

  return { messages, isStreaming, sendMessage };
}
```

### 验收标准
- [ ] Token 逐字显示
- [ ] 引用标记正确注入
- [ ] 支持中断生成
- [ ] 网络断开时正确处理

---

## 完整文件清单

```
app/
├── api/chat/
│   ├── sessions/
│   │   ├── route.ts                    # GET(列表) / POST(创建)
│   │   └── [id]/
│   │       ├── route.ts                # GET / DELETE
│   │       └── messages/
│   │           ��── route.ts            # POST(发送消息，支持 selectedSourceIds)
│   └── kb/[id]/chat/
│       └── page.tsx                    # Chat 主页面
│
components/chat/
├── LeftSidebar.tsx                     # 左侧边栏容器
│   ├── CollapsibleSection.tsx          # 可折叠区域组件
│   ├── ChatHistoryList.tsx             # 对话历史清单
│   └── DocumentSourceList.tsx          # 文件源清单
│       ├── SourceItem.tsx              # 单个源项（含勾选框）
│       └── AddSourceDialog.tsx         # 添加源对话框
├── ChatArea.tsx                        # 对话主区域
│   ├── MessageList.tsx                 # 消息列表
│   ├── MessageInput.tsx                # 输入框
│   └── QuickNote.tsx                   # 快速笔记区
├── NotesPreviewSidebar.tsx             # 笔记预览侧边栏
├── Citation.tsx                        # 引用标记（Sprint 0）
├── MessageBubble.tsx                   # 消息气泡
└── TypingIndicator.tsx                 # 输入中动画
│
lib/
├── chat/
│   ├── citation-injector.ts           # 引用注入算法
│   ├── stream-handler.ts               # 流式处理
│   └── prompt-templates.ts            # RAG 提示词模板
├── stores/
│   ├── chat-store.ts                   # 对话状态管理
│   └── document-source-store.ts        # 文件源勾选状态管理
└── hooks/
    └── useChatStream.ts                # 流式对话 Hook
```

---

## 完成标准

Sprint 1 完成当：
- [ ] 用户可以创建多轮对话
- [ ] 用户可以管理文件源（添加、删除、勾选）
- [ ] AI 仅在勾选的源中进行检索
- [ ] AI 回复基于文档检索结果
- [ ] 引用正确显示和交互
- [ ] 流式响应体验流畅
- [ ] 会话历史持久化

---

## 后续预览

Sprint 1 完成后，用户可以：
- 与知识库进行多轮对话
- 选择性地在特定文档源中检索
- 看到实时的 AI 回复
- 查看引用来源

下一步 (Sprint 2) 将添加：
- 从对话中保存笔记
- 笔记编辑和管理
- 笔记的 RAG 集成
