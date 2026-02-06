# Context OS 开发任务总览

> **项目定位**: 个人知识工作台 (Personal Knowledge Workbench)
> **核心隐喻**: Notebook（笔记本）- 持久化的思考容器
> **文档版本**: v1.0
> **最后更新**: 2025-01-13

---

## 🎯 产品愿景

Context OS 不是一个 RAG 问答系统，也不是简单的知识库搜索工具。

**它是**：一个以对话为界面的个人知识工作台，核心是 Notebook（笔记本）概念——让用户的思考可以被持久化、结构化、复用。

```
┌─────────────────────────────────────────────────────────────────┐
│                                                             │
│   收集 (Collect)    →    对话思考 (Converse)    →    沉淀 (Create) │
│                                                             │
│   上传文档              与 AI 对话               保存为笔记      │
│   网页抓取              获得洞察                结构化输出      │
│   手动输入              引用溯源                可复用         │
│                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌─────────────┐
                      │  Notebook   │
                      │  (知识库)    │
                      └─────────────┘
```

---

## 📋 Sprint 规划

| Sprint | 主题 | 周期 | 核心交付 |
|--------|------|------|----------|
| **Sprint 0** | 基础设施 | 2-3 天 | SSE、LLM 集成、Citation 组件 |
| **Sprint 1** | 核心对话体验 | 3-5 天 | 多轮对话、流式响应、RAG 检索 |
| **Sprint 2** | Notebook 沉淀 | 4-5 天 | 对话转笔记、笔记编辑器、笔记 RAG |
| **Sprint 3** | 文档理解增强 | 3-4 天 | 文档摘要页、快速预览、智能摘取 |

---

## 🔧 技术栈

### 前端
```json
{
  "framework": "Next.js 16.1.1 (App Router)",
  "ui": "shadcn/ui (Radix UI + Tailwind)",
  "state": "Zustand",
  "editor": "novel / @mdxeditor/editor",
  "llm": "AI SDK (Verbatim)"
}
```

### 后端
```json
{
  "runtime": "Node.js",
  "database": "SQLite (better-sqlite3)",
  "vector": "Qdrant",
  "llm": "SiliconFlow (DeepSeek V3 Pro)",
  "embedding": "SiliconFlow / BGE-M3",
  "parsers": "mammoth (DOCX), unpdf (PDF)"
}
```

---

## 📁 文档结构

```
docs/tasks/
├── README.md                    # 本文件
├── sprint-0-infrastructure.md   # 基础设施任务
├── sprint-1-chat-core.md         # 对话体验任务
├── sprint-2-notebook.md          # Notebook 任务
└── sprint-3-document-enhancement.md  # 文档增强任务
```

---

## 🚀 快速开始

### 环境配置

```bash
# 复制环境变量
cp .env.example .env.local

# 编辑 .env.local，添加：
# SILICONFLOW_API_KEY=your_key_here
# DATABASE_URL=./data/context-os.db
```

### 启动开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

---

## 📊 任务优先级矩阵

```
高价值 ━─────────────────────────────┐
       │                              │
   P1  │  Sprint 1                   │  P2
       │  (Chat Core)                 │  (Notebook)
       │                              │
────────┼──────────────────────────────┼────────
       │                              │
   P0  │  Sprint 0                   │  P3
       │  (Infrastructure)            │  (Enhancement)
       │                              │
低价值 └─────────────────────────────┘
        低紧急度 ←────────→ 高紧急度
```

---

## 🔗 任务依赖关系

```
                    Sprint 0
                  ┌─────────┐
                  │ SSE     │
                  │ LLM     │
                  │ Citation│
                  └────┬────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
    Sprint 1                   Sprint 2
  ┌───────────┐             ┌─────────────┐
  │ Chat Page │             │ Note Editor  │
  │ RAG Chain │             │ Note Blocks │
  │ Streaming │             │ Note RAG    │
  └─────┬─────┘             └──────┬──────┘
        │                          │
        └────────────┬─────────────┘
                     ▼
                Sprint 3
          ┌──────────────────┐
          │ Document Detail  │
          │ Quick Preview    │
          │ Smart Extract    │
          └──────────────────┘
```

---

## ✅ 完成标准

### Sprint 0 完成标志
- [ ] SSE 流式传输 Demo 可运行
- [ ] SiliconFlow API 调用成功
- [ ] Citation 组件在 Storybook 中展示

### Sprint 1 完成标志
- [ ] 用户可以创建多轮对话
- [ ] AI 回复基于文档检索结果
- [ ] 引用正确显示和交互
- [ ] 流式响应体验流畅

### Sprint 2 完成标志
- [ ] 用户可以从对话保存笔记
- [ ] 笔记编辑器功能完整
- [ ] 笔记可被搜索和引用
- [ ] AI 辅助功能正常

### Sprint 3 完成标志
- [ ] 文档摘要页完整展示
- [ ] 快速预览功能流畅
- [ ] 智能摘取准确可用

---

## 🎨 设计规范

### 颜色系统
```css
--primary: 222.2 47.4% 11.2%;        /* Blue 600 */
--secondary: 210 40% 96.1%;          /* Slate 500 */
--accent: 142.1 76.2% 36.3%;         /* Orange 600 */
--muted: 210 40% 96.1%;             /* Slate 400 */
--border: 214.3 31.8% 91.4%;        /* Slate 200 */
```

### 引用标记样式
- 标记：右上标蓝色圆圈数字 (①②③)
- 大小：`h-4 w-4 min-w-4 rounded-full`
- 颜色：`bg-blue-100 text-blue-700`
- 交互：hover 显示 Tooltip 卡片

### 对话气泡
- 用户：白色背景，右侧对齐
- AI：浅灰背景，左侧对齐
- 间距：`gap-4`，最大宽度 `lg:max-w-[80%]`

---

## 📝 开发规范

### 命名约定
```
组件文件: PascalCase (MessageList.tsx)
工具文件: camelCase (citation-injector.ts)
常量文件: UPPER_SNAKE_CASE (API_ENDPOINTS.ts)
类型文件: PascalCase.types.ts
```

### Git 提交规范
```
feat: 新功能
fix: 修复
docs: 文档
style: 格式调整
refactor: 重构
test: 测试
chore: 构建/工具
```

---

## 🔍 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| SiliconFlow API 不稳定 | 中 | 高 | 添加降级方案，支持本地模型 |
| SSE 兼容性问题 | 低 | 中 | EventSource polyfill |
| LLM 幻觉 | 高 | 中 | 严格引用来源，允许用户反馈 |
| 数据库迁移 | 低 | 中 | 备份+版本化迁移脚本 |
| Qdrant 性能 | 低 | 高 | 分批处理，添加缓存 |

---

## 📞 联系方式

- **产品讨论**: [创建 Issue]
- **技术问题**: [创建 Issue 标签: bug]
- **功能建议**: [创建 Issue 标签: enhancement]

---

## 📜 变更日志

### v1.0 (2025-01-13)
- 初始版本发布
- 定义 Sprint 0-3 任务
- 建立技术架构

---

*本文档随项目演进持续更新*
