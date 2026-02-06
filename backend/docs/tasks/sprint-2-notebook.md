# Sprint 2: Notebook 沉淀能力

> **目标**: 实现"从对话到笔记"的沉淀流程，建立 Notebook 的核心价值
> **周期**: 4-5 天
> **依赖**: Sprint 1 完成

## 概述

Sprint 2 实现知识的**沉淀**能力：
1. **对话转笔记** - 用户可选择对话内容保存为笔记
2. **笔记编辑器** - Markdown 编辑 + AI 辅助
3. **笔记卡片** - 结构化内容块（引用/洞察/待办）
4. **笔记 RAG 集成** - 笔记可被搜索和引用

---

## 核心理念：从对话到笔记

```
对话是流动的思考，笔记是凝固的智慧

┌─────────────┐      保存      ┌─────────────┐
│   对话      │  ────────→   │   笔记      │
│  (流动)     │              │  (沉淀)     │
└─────────────┘              └─────────────┘
      │                           │
      │ 可检索                    │ 可编辑
      │ 可引用                    │ 可复用
      └───────────────────────────┘
```

---

## 任务 2.1: 对话转笔记

### 描述
让用户从对话中选择内容保存为笔记，支持手动选择和 AI 智能提取。

### 交互设计

#### 选择保存模式
```
┌──────────────────────────────────────────────────────────┐
│ AI: 本文介绍了 Context OS 的产品愿景¹。它采用混合     │
│     架构²来解决高并发问题，同时...                      │
│                                                          │
│ [📝 保存这段话] [✓ 保存整个回复]                         │
└──────────────────────────────────────────────────────────┘
         ↓ 点击保存
┌──────────────────────────────────────────────────────────┐
│ 💾 保存到笔记                                            │
│ ─────────────────────────────────────────────────────────│
│                                                          │
│ 内容: [已填充]                                           │
│                                                          │
│ 标签: [引用] [洞察] [待办] [+ 自定义]                   │
│                                                          │
│ 标题: [自动生成或手动输入]                                │
│                                                          │
│        [取消]                    [保存]                   │
└──────────────────────────────────────────────────────────┘
```

#### AI 智能提取
```
┌──────────────────────────────────────────────────────────┐
│ ✨ AI 提取关键点                                         │
│ ─────────────────────────────────────────────────────────│
│ 根据对话内容，AI 自动提取：                               │
│                                                          │
│ ☑ 1. Context OS 的产品愿景是...                         │
│ ☑ 2. 采用混合架构解决高并发问题                          │
│ ☑ 3. 使用流量大坝机制解耦请求与 GPU                     │
│                                                          │
│ [全选] [反选] [保存为笔记]                               │
└──────────────────────────────────────────────────────────┘
```

### 技术方案

#### 数据模型
```sql
-- 笔记表扩展
ALTER TABLE notes ADD COLUMN type TEXT DEFAULT 'manual';
ALTER TABLE notes ADD COLUMN tags TEXT;  -- JSON 数组
ALTER TABLE notes ADD COLUMN source_type TEXT;  -- 'chat' | 'manual' | 'document'
ALTER TABLE notes ADD COLUMN source_id TEXT;    -- 关联 source
ALTER TABLE notes ADD COLUMN metadata TEXT;     -- JSON 扩展字段

-- 笔记块表（结构化内容）
CREATE TABLE IF NOT EXISTS note_blocks (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'quote' | 'insight' | 'todo' | 'question'
  content TEXT NOT NULL,
  citations TEXT,      -- JSON 关联的引用
  status TEXT,         -- for todo: 'pending' | 'done'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

#### 保存流程
```typescript
// app/api/notes/route.ts
export async function POST(req: NextRequest) {
  const { content, tags, sourceType, sourceId, blocks } = await req.json();
  const user = await getCurrentUser();

  // 1. 创建笔记
  const note = await createNote({
    userId: user.id,
    kbId: sourceId,  // 假设从 chat session 关联的 kb
    content,
    tags,
    sourceType,
    sourceId,
  });

  // 2. 创建笔记块
  if (blocks) {
    for (const block of blocks) {
      await createNoteBlock({
        noteId: note.id,
        ...block,
      });
    }
  }

  // 3. 笔记也需要 RAG 处理
  await processNoteForRAG(note);

  return NextResponse.json({ note });
}

// 笔记 RAG 处理
async function processNoteForRAG(note: Note) {
  // 1. 提取纯文本（移除 Markdown 格式）
  const cleanText = extractTextFromMarkdown(note.content);

  // 2. 生成向量
  const embedding = await embedText(cleanText);

  // 3. 存入 Qdrant（type: 'note'）
  await upsertPoints(user.id, [{
    id: `note_${note.id}`,
    vector: embedding,
    payload: {
      doc_id: note.id,
      kb_id: note.kb_id,
      user_id: note.userId,
      type: 'note',
      content: note.content,
      metadata: {
        tags: note.tags,
        source_type: note.sourceType,
      },
    },
  }]);
}
```

### 验收标准
- [ ] 用户可选择单条消息或整个回复保存
- [ ] AI 能提取对话中的关键点
- [ ] 保存的笔记显示在笔记侧边栏
- [ ] 笔记可被 RAG 检索

---

## 任务 2.2: 笔记编辑器

### 描述
实现 Markdown 编辑器，支持实时预览和 AI 辅助功能。

### 功能需求

#### 基础编辑
- Markdown 语法高亮
- 实时预览
- 快捷键支持（Ctrl+B 加粗等）

#### AI 辅助
```
┌──────────────────────────────────────────────────────────┐
│ # Context OS 产品笔记                                    │
│                                                          │
│ ## 核心特性                                              │
│ 1. 混合架构                                              │
│ 2. 流量大坝机制                                          │
│                                                          │
│ [AI] │                                                  │
└──────────────────────────────────────────────────────────┘
       ↓ 点击 [AI]
┌──────────────────────────────────────────────────────────┐
│ 🤖 AI 助手                                               │
│ ─────────────────────────────────────────────────────────│
│                                                          │
│ [📝 续写] [✨ 优化] [📋 总结] [❓ 提问]                   │
│                                                          │
│ ─────────────────────────────────────────────────────────│
│ 或输入指令...                                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 技术方案

#### 编辑器选择
推荐使用 `novel` 或 `@uiw/react-md-editor`：

```typescript
// components/editor/NoteEditor.tsx
import { MDXEditor } from '@mdxeditor/editor';

export function NoteEditor({
  content,
  onChange,
  onSave,
}: NoteEditorProps) {
  return (
    <div className="h-full flex flex-col">
      <Toolbar>
        <AIAssistButton />
        <SaveButton onClick={onSave} />
      </Toolbar>
      <MDXEditor
        markdown={content}
        onChange={onChange}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          // 自定义笔记插件
          noteBlockPlugin(),
        ]}
      />
    </div>
  );
}
```

#### AI 辅助功能
```typescript
// lib/ai/note-assistant.ts
export async function assistNote(params: {
  action: 'continue' | 'improve' | 'summarize' | 'question';
  content: string;
}) {
  const prompts = {
    continue: `请基于以下内容继续撰写：\n\n${params.content}`,
    improve: `请优化以下笔记的表达和结构：\n\n${params.content}`,
    summarize: `请总结以下笔记的要点：\n\n${params.content}`,
    question: `基于以下笔记，生成 3 个值得深入探讨的问题：\n\n${params.content}`,
  };

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompts[params.action] }],
  });

  return response.choices[0].message.content;
}
```

### 验收标准
- [ ] Markdown 编辑器正常工作
- [ ] 实时预览同步
- [ ] AI 续写/优化/总结功能
- [ ] 自动保存（防丢失）

---

## 任务 2.3: 笔记卡片

### 描述
实现结构化的笔记内容块，支持不同类型的内容展示。

### 卡片类型

#### 1. 引用卡片 (Quote)
```markdown
> 来自文档的引用内容
>
> — Context OS PRD.md
```

#### 2. 洞察卡片 (Insight)
```markdown
## 💡 洞察

Context OS 的核心价值在于将"文件堆放处"升级为"意图发射台"。
```

#### 3. 待办卡片 (Todo)
```markdown
## ☐ 待办

- [ ] 实现多轮对话
- [ ] 添加笔记功能
- [ ] 部署到生产环境
```

#### 4. 问题卡片 (Question)
```markdown
## ❓ 问题

如何处理超长文档的分块检索效果？
```

### 技术方案

#### 笔记块组件
```typescript
// components/note/NoteBlock.tsx
export function NoteBlock({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case 'quote':
      return <QuoteBlock block={block} />;
    case 'insight':
      return <InsightBlock block={block} />;
    case 'todo':
      return <TodoBlock block={block} />;
    case 'question':
      return <QuestionBlock block={block} />;
    default:
      return <TextBlock block={block} />;
  }
}

// components/note/QuoteBlock.tsx
export function QuoteBlock({ block }: { block: NoteBlock }) {
  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
      <CardContent className="p-4">
        <p className="italic text-sm">{block.content}</p>
        {block.citations && (
          <div className="mt-2 flex gap-1">
            {block.citations.map((cit, i) => (
              <Citation key={i} {...cit} />
            ))}
          </div>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          — {block.source}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 笔记块解析
```typescript
// lib/note/block-parser.ts
export function parseNoteBlocks(markdown: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const lines = markdown.split('\n');
  let currentBlock: Partial<NoteBlock> | null = null;

  for (const line of lines) {
    // 解析 ### 💡 洞察
    if (line.match(/^###\s*[💡]\s*洞察/i)) {
      currentBlock = { type: 'insight', content: '' };
      continue;
    }

    // 解析 > 引用
    if (line.startsWith('> ')) {
      if (currentBlock?.type !== 'quote') {
        currentBlock = { type: 'quote', content: '' };
      }
      currentBlock.content += line.slice(2) + '\n';
      continue;
    }

    // 解析 - [ ] 待办
    if (line.match(/-\s*\[\s*]/)) {
      if (currentBlock?.type !== 'todo') {
        currentBlock = { type: 'todo', items: [] };
      }
      currentBlock.items.push({ text: line.replace(/-\s*\[\s*\]/, ''), done: false });
      continue;
    }

    // 保存完成的块
    if (currentBlock && line.trim() === '') {
      blocks.push(currentBlock as NoteBlock);
      currentBlock = null;
    }
  }

  return blocks;
}
```

### 验收标准
- [ ] 支持四种笔记块类型
- [ ] 笔记块正确解析和渲染
- [ ] 待办卡片支持勾选完成
- [ ] 笔记块可拖拽排序

---

## 任务 2.4: 笔记 RAG 集成

### 描述
让笔记也能被搜索和引用，形成完整的知识闭环。

### 技术方案

#### 统一检索接口
```typescript
// lib/search/unified-search.ts
export async function unifiedSearch(params: {
  userId: string;
  kbId: string;
  query: string;
}) {
  const queryVector = await embedQuery(params.query);

  // 同时搜索文档和笔记
  const [docResults, noteResults] = await Promise.all([
    searchByType(params.userId, queryVector, {
      filter: { kbId: params.kbId, type: { $in: ['document', 'parent', 'child'] } },
    }),
    searchByType(params.userId, queryVector, {
      filter: { kbId: params.kbId, type: 'note' },
    }),
  ]);

  // 合并结果，笔记优先级稍高（因为是用户主动保存的）
  return {
    documents: docResults,
    notes: noteResults,
    all: [...noteResults, ...docResults],  // 笔记在前
  };
}
```

#### 笔记向量存储
```typescript
// lib/processors/note-processor.ts
export async function processNoteForRAG(note: Note) {
  // 1. 提取纯文本
  const cleanText = stripMarkdown(note.content);

  // 2. 分块（笔记通常较短，可能不需要分块）
  const chunks = splitText(cleanText, { maxChunkSize: 500 });

  // 3. 生成向量并存储
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);

    await upsertPoints(note.user_id, [{
      id: `note_${note.id}_${i}`,
      vector: embedding,
      payload: {
        doc_id: note.id,
        kb_id: note.kb_id,
        user_id: note.user_id,
        type: 'note',
        content: chunks[i],
        chunk_index: i,
        metadata: {
          note_title: extractTitle(note.content),
          tags: note.tags,
          created_at: note.created_at,
        },
      },
    }]);
  }

  // 4. 更新数据库
  await updateNoteChunkCount(note.id, chunks.length);
}
```

### 验收标准
- [ ] 笔记在搜索结果中显示
- [ ] 笔记可作为引用来源
- [ ] 笔记更新后重新索引
- [ ] 删除笔记时清理向量

---

## 完整文件清单

```
app/
├── api/notes/
│   ├── route.ts                    # GET(列表) / POST(创建)
│   └── [id]/
│       ├── route.ts                # GET / PUT / DELETE
│       └── blocks/
│           └── route.ts            # 笔记块操作
│
components/note/
├── NoteEditor.tsx                  # Markdown 编辑器
├── NoteBlock.tsx                   # 笔记块渲染器
│   ├── QuoteBlock.tsx              # 引用块
│   ├── InsightBlock.tsx            # 洞察块
│   ├── TodoBlock.tsx               # 待办块
│   └── QuestionBlock.tsx           # 问题块
├── NoteCard.tsx                    # 笔记卡片
├── AIAssistButton.tsx              # AI 辅助按钮
└── NoteListSidebar.tsx             # 笔记列表侧边栏
│
lib/
├── note/
│   ├── block-parser.ts             # 笔记块解析
│   ├── block-generator.ts          # 笔记块生成
│   └── note-processor.ts           # 笔记 RAG 处理
├── ai/
│   └── note-assistant.ts            # 笔记 AI 辅助
└── stores/
    └── note-store.ts               # 笔记状态管理
```

---

## 完成标准

Sprint 2 完成当：
- [ ] 用户可以从对话保存笔记
- [ ] 笔记编辑器功能完整
- [ ] 笔记块正确解析和渲染
- [ ] 笔记可被搜索和引用
- [ ] AI 辅助功能正常工作

---

## 后续预览

Sprint 2 完成后，用户可以：
- 从对话中快速保存笔记
- 编辑和组织笔记
- 笔记成为知识库的一部分

下一步 (Sprint 3) 将完善：
- 文档详情页
- 快速预览功能
- 智能摘取功能
