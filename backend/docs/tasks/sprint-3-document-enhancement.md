# Sprint 3: 文档理解增强

> **目标**: 完善文档查看体验，建立完整的知识管理工作流
> **周期**: 3-4 天
> **依赖**: Sprint 1, Sprint 2 完成

## 概述

Sprint 3 完善产品的**文档理解**能力：
1. **文档摘要页** - 显示 Executive Summary 和元数据
2. **快速预览** - 文档内容内联预览，无需跳转
3. **智能摘取** - 从对话中提取要点到笔记（自动化）

---

## 任务 3.1: 文档摘要页

### 描述
创建文档详情页，重点展示 K-Type 分析的 Executive Summary，而非完整的分析结果。

### 页面设计

```
┌─────────────────────────────────────────────────────────────────┐
│ Context OS PRD.docx                     [← 返回] [⋮ 更多]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ## 执行摘要 (Executive Summary)                                 │
│ ──────────────────────────────────────────────────────────────│
│                                                                 │
│ Context OS 是一个企业级知识资产管理与深加工平台，旨在将传统    │
│ 的"文件堆放处"升级为用户"意图的发射台"。                          │
│                                                                 │
│ 核心技术策略包括：                                               │
│ • 混合架构：计算层部署在云 ECS，数据层托管给 Supabase           │
│ • 流量大坝：解耦用户请求与 GPU 资源                            │
│ • DeepK-Hybrid：全量上下文 + 代理人反思机制                    │
│                                                                 │
│ ## 文档元数据                                                   │
│ ──────────────────────────────────────────────────────────────│
│                                                                 │
│ | 属性 | 值 |                                                   │
│ │------|-----|                                                   │
│ │ 文件大小 | 40.7 KB |                                            │
│ │ 文本长度 | 16,189 字符 |                                        │
│ │ 分块数量 | 47 个 |                                               │
│ │ 主导类型 | 方法论 • 技术架构                                   │
│ │ DIKW 层级 | Wisdom (知识)                                      │
│ │ 上传时间 | 2025-01-13                                           │
│                                                                 │
│ ## 快速操作                                                     │
│ ──────────────────────────────────────────────────────────────│
│                                                                 │
│ [💬 与此文档对话]  [📋 查看完整内容]  [🔄 重新处理]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 技术方案

#### API 端点
```typescript
// app/api/documents/[id]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  const doc = await getDocumentById(params.id);

  if (!doc || doc.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 解析元数据
  const metadata = {
    ktype: doc.ktype_metadata ? JSON.parse(doc.ktype_metadata) : null,
    summary: doc.deep_summary || null,
  };

  return NextResponse.json({
    id: doc.id,
    fileName: doc.file_name,
    fileSize: doc.file_size,
    content: doc.file_content,  // Markdown 内容
    chunkCount: doc.chunk_count,
    status: doc.status,
    ...metadata,
  });
}
```

#### 页面组件
```typescript
// app/kb/[id]/doc/[docId]/page.tsx
export default function DocumentDetailPage() {
  const doc = useDocument(docId);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <DocumentHeader doc={doc} />

        {/* Executive Summary */}
        {doc.summary && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">执行摘要</h2>
            <Card>
              <CardContent className="pt-6">
                <p className="whitespace-pre-wrap">{doc.summary}</p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Metadata */}
        <DocumentMetadata doc={doc} />

        {/* Quick Actions */}
        <QuickActions doc={doc} />

        {/* Full Content - Collapsible */}
        <details className="mt-8">
          <summary className="cursor-pointer text-lg font-semibold">
            查看完整内容 ▼
          </summary>
          <div className="mt-4 prose max-w-none">
            <ReactMarkdown>{doc.content}</ReactMarkdown>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
```

### 验收标准
- [ ] 页面正确显示文档信息
- [ ] Executive Summary 格式化展示
- [ ] 元数据以表格形式展示
- [ ] 快速操作按钮功能正常

---

## 任务 3.2: 快速预览

### 描述
实现文档内容的内联预览，用户无需跳转即可查看文档内容。

### 交互设计

```
用户消息：Context OS 的混合架构是怎样的？

AI 回复：Context OS 采用混合架构²...
            ②
            │
            ▼ 鼠标悬停
┌─────────────────────────────────────────────────────────┐
│ 📄 Context OS PRD.docx - 混合架构相关内容                │
│ ───────────────────────────────────────────────────────│
│                                                         │
│ 1.4 核心技术策略                                        │
│                                                         │
│ 为了实现 MVP 的快速交付与高性能：                       │
│                                                         │
│ • 混合架构：计算层（Next.js + OneAPI）部署在阿里云 ECS  │
│ • 数据层（数据库、Auth、向量检索、存储）全面托管给... │
│                                                         │
│                [查看完整文档 →]                         │
└─────────────────────────────────────────────────────────┘
```

### 技术方案

#### 引用上下文提取
```typescript
// lib/search/context-extractor.ts
export async function extractCitationContext(params: {
  docId: string;
  chunkIndex: number;
  windowSize?: number;  // 上下文窗口大小
}): Promise<string> {
  const doc = await getDocumentById(params.docId);

  // 获取文档的所有分块
  const chunks = await getDocumentChunks(doc.id);

  // 找到目标分块
  const targetIndex = params.chunkIndex;

  // 提取上下文（前后各取几个分块）
  const start = Math.max(0, targetIndex - (params.windowSize || 1));
  const end = Math.min(chunks.length, targetIndex + (params.windowSize || 1) + 1);

  const contextChunks = chunks.slice(start, end);

  // 合并并格式化
  return contextChunks
    .map((c, i) => {
      const chunkNum = start + i + 1;
      return `...${chunkNum > 1 ? '\n' : ''}${c.content}`;
    })
    .join('\n\n');
}
```

#### 预览组件
```typescript
// components/chat/CitationPreview.tsx
export function CitationPreview({ citation }: { citation: Citation }) {
  const [context, setContext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMouseEnter = async () => {
    if (context) return;
    setLoading(true);
    setContext(await extractCitationContext(citation));
    setLoading(false);
  };

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <Badge {...citation} onMouseEnter={handleMouseEnter} />
      </HoverCardTrigger>
      <HoverCardContent className="w-96 p-0" side="right">
        <div className="border-b px-4 py-2 bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {citation.docName}
            </span>
            {citation.chunkIndex !== undefined && (
              <span className="text-xs text-muted-foreground">
                块 {citation.chunkIndex + 1}
              </span>
            )}
          </div>
        </div>
        <div className="p-4 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : context ? (
            <p className="text-sm whitespace-pre-wrap">{context}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              移动鼠标查看内容...
            </p>
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Link
            href={`/kb/${citation.kbId}/doc/${citation.docId}`}
            className="text-xs text-primary hover:underline"
          >
            查看完整文档 →
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
```

### 验收标准
- [ ] 悬停显示文档上下文
- [ ] 上下文包含前后分块
- [ ] 支持跳转到完整文档
- [ ] 加载状态友好显示

---

## 任务 3.3: 智能摘取

### 描述
实现自动从对话中提取有价值的内容到笔记，减少用户手动操作。

### 触发时机

#### 自动触发
- 检测到对话中有明确的结论或洞察
- 用户明确表示"记下来"、"保存这个"

#### 手动触发
- 用户点击"提取笔记"按钮
- 用户选中对话中的文本

### 技术方案

#### 智能提取算法
```typescript
// lib/ai/smart-extract.ts
export async function extractInsightsFromChat(params: {
  sessionId: string;
  recentMessageCount?: number;
}) {
  // 1. 获取最近的对话
  const messages = await getSessionMessages(
    params.sessionId,
    params.recentMessageCount || 20
  );

  // 2. 调用 LLM 提取洞察
  const prompt = `
以下是用户与 AI 的对话记录，请提取其中值得保存为笔记的内容。

对话记录：
${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

请以 JSON 格式返回提取的笔记，格式如下：
[
  {
    "type": "insight",
    "title": "简短标题",
    "content": "详细内容",
    "tags": ["标签1", "标签2"],
    "relatedMessages": [1, 2, 3]  // 相关的消息索引
  }
]

只返回真正有价值的内容，避免重复或琐碎的信息。
`;

  const response = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const insights = JSON.parse(response.choices[0].message.content);

  // 3. 创建笔记
  const createdNotes = [];
  for (const insight of insights) {
    const note = await createNote({
      userId: currentUserId,
      kbId: currentKbId,
      content: formatAsNoteMarkdown(insight),
      tags: insight.tags,
      sourceType: 'chat_extraction',
      sourceId: params.sessionId,
    });

    // 4. RAG 处理
    await processNoteForRAG(note);

    createdNotes.push(note);
  }

  return createdNotes;
}
```

#### 提取建议 UI
```typescript
// components/chat/ExtractionSuggestion.tsx
export function ExtractionSuggestion({ insights }: { insights: Insight[] }) {
  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">发现 {insights.length} 条可保存的内容</span>
        </div>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Checkbox id={`insight-${i}`} />
              <label
                htmlFor={`insight-${i}`}
                className="flex-1 cursor-pointer"
              >
                <span className="font-medium">{insight.title}</span>
                <p className="text-muted-foreground text-xs mt-1">
                  {insight.content.substring(0, 100)}...
                </p>
              </label>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={saveSelected}>
            保存选中的 ({selectedCount})
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            暂不保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 验收标准
- [ ] AI 能识别有价值的对话内容
- [ ] 提取建议准确率 > 70%
- [ ] 用户可以选择性保存
- [ ] 保存的笔记格式正确

---

## 完整文件清单

```
app/
├── api/documents/
│   └── [id]/
│       └── route.ts                # 文档详情 API
│
components/document/
├── DocumentHeader.tsx              # 文档头部
├── DocumentMetadata.tsx            # 元数据展示
├── QuickActions.tsx                # 快速操作按钮
└── ContentViewer.tsx               # 内容查看器
│
components/chat/
├── CitationPreview.tsx             # 引用悬停预览
└── ExtractionSuggestion.tsx        # 智能摘取建议
│
lib/
├── search/
│   └── context-extractor.ts        # 上下文提取
├── ai/
│   └── smart-extract.ts             # 智能提取算法
└── extractors/
    └── insight-detector.ts         # 洞察检测器
```

---

## 完成标准

Sprint 3 完成当：
- [ ] 文档详情页完整展示
- [ ] Executive Summary 格式化显示
- [ ] 快速预览功能流畅
- [ ] 智能摘取准确可用
- [ ] 所有功能端到端测试通过

---

## 🎉 所有 Sprint 完成后的产品状态

完成 Sprint 0-3 后，Context OS 将具备：

```
┌─────────────────────────────────────────────────────────────┐
│                    Context OS 功能矩阵                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  核心能力         │ 状态  │ 说明                           │
│  ─────────────────┼──────┼──────────────────────────────│
│  文档上传         │ ✅   │ 解析为 Markdown，存储到 DB     │
│  K-Type 分析      │ ✅   │ 自动认知分析                   │
│  向量检索         │ ✅   │ 三层钻取检索                   │
│  多轮对话         │ ✅   │ 流式响应，上下文管理           │
│  引用系统         │ ✅   │ 上标标记 + 悬浮预览           │
│  对话转笔记       │ ✅   │ 手动选择 + AI 智能提取         │
│  笔记编辑         │ ✅   │ Markdown + AI 辅助             │
│  笔记 RAG         │ ✅   │ 笔记可被搜索引用               │
│  文档详情         │ ✅   │ 摘要 + 元数据 + 全文           │
│  快速预览         │ ✅   │ 悬停查看上下文                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

用户可以：
1. 上传文档 → 自动解析和索引
2. 与知识库对话 → 获得基于文档的答案
3. 从对话中保存笔记 → 沉淀知识
4. 搜索和引用笔记 → 知识闭环
5. 查看文档详情 → 深入理解

---

## 后续优化方向

Sprint 3 完成后，可以考虑：
- 批量文档上传
- 文档版本管理
- 知识图谱可视化
- 导出为 PDF/Word
- 团队协作功能
- 移动端优化
