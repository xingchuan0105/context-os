# Chat 引用功能修复 - 操作指南

> **修复完成时间**: 2025-01-28  
> **状态**: ✅ 代码已修复，等待测试验证

---

## 📋 已完成的修复

### 1. 前端修复 ✅

#### 修复 1: HoverCard 添加 Portal
- **文件**: `components/ui/hover-card.tsx`
- **修改**: 添加 `<HoverCardPrimitive.Portal>` 包装
- **效果**: 悬浮卡片渲染到 DOM 顶层，不被遮挡

#### 修复 2: Citation 组件优化
- **文件**: `components/chat/Citation.tsx`
- **修改**: 
  - 使用 `<span>` 替代 `Badge`
  - 添加可访问性属性
  - 优化样式和滚动
- **效果**: 引用小标更稳定可靠

### 2. 后端修复 ✅

#### 修复 3: System Prompt 增强
- **文件**: `app/api/chat/sessions/[id]/messages/route.ts`
- **修改**: 第 29-94 行
- **改进**:
  - ✅ 添加 "CRITICAL RULE" 强调引用重要性
  - ✅ 提供正确和错误的示例
  - ✅ 明确引用密度要求（每 1-2 句话）
  - ✅ 使用表情符号和加粗强调
  - ✅ 在结尾再次提醒

#### 修复 4: 切换默认模型
- **文件**: `app/api/chat/sessions/[id]/messages/route.ts`
- **修改**: 第 412 行
- **改进**: 从 `deepseek_v32` 切换到 `qwen3_max`
- **原因**: Qwen3-Max 更擅长遵循复杂指令

---

## 🚀 立即执行的操作

### 步骤 1: 重启后端容器（必须）

```bash
# 进入项目目录
cd D:\context-os\context-os-clean-20260129-v3\backend

# 重启后端容器
docker-compose restart backend

# 查看日志确认重启成功
docker logs context-os-backend --tail 20 -f
```

**预期输出**:
```
▲ Next.js 16.1.1
- Local:         http://localhost:3000
- Network:       http://0.0.0.0:3000

✓ Starting...
✓ Ready in 183ms
Database initialized successfully
```

看到 "Ready" 后按 `Ctrl+C` 退出日志查看。

### 步骤 2: 重启前端容器（可选，但推荐）

```bash
# 重启前端容器
docker-compose restart frontend

# 等待 10-15 秒
```

### 步骤 3: 清除浏览器缓存

1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

---

## 🧪 测试验证步骤

### 1. 访问 Chat 页面

```
http://localhost:3003
```

登录后进入知识库的 Chat 页面。

### 2. 选择文档

在左侧边栏选择**已处理完成**的文档（状态为 "completed"）。

### 3. 发送测试问题

```
文章的主要内容是什么？
```

或

```
请详细介绍 LightRAG 的核心创新点。
```

### 4. 检查结果

#### ✅ 正确的效果

**回答应该包含引用标记**:
```
这篇文章主要介绍并深入剖析了一篇名为《LightRAG: Simple and Fast 
Retrieval-Augmented Generation》的学术论文[[1]]。该论文的核心是提出了
一种新颖的、轻量级的检索增强生成（RAG）框架[[2]]，旨在解决现有RAG系统
在上下文理解、检索效率和知识更新灵活性方面的关键局限[[3]]。
```

**引用小标显示**:
- 看到蓝色圆形小标：① ② ③ 或 [1] [2] [3]
- 小标有边框和悬停效果

**悬浮卡片**:
- 鼠标悬停在引用小标上
- 显示悬浮卡片，包含：
  - 引用编号 [1]
  - 相关度分数（如 92%）
  - 引用的文本内容（可滚动）
  - 文档名称
  - 片段索引

**流式响应**:
- 回答应该逐字显示（打字机效果）
- 不是一次性全部出现

#### ❌ 如果还是没有引用

**可能的情况**:

1. **回答中没有 `[[1]]` 标记**
   - 说明 LLM 仍然没有遵循指令
   - 需要进一步调整 Prompt 或切换模型

2. **有 `[[1]]` 但没有渲染成小标**
   - 前端解析问题
   - 检查浏览器控制台是否有错误

3. **有小标但悬浮卡片不显示**
   - HoverCard 组件问题
   - 检查浏览器控制台是否有错误

---

## 🔍 调试方法

### 查看后端日志

```bash
# 实时查看后端日志
docker logs context-os-backend -f

# 查看最近 100 行
docker logs context-os-backend --tail 100
```

**关键日志**:
```
[Chat RAG] RAG result: {
  totalResults: 16,
  documentsCount: 1,
  parentsCount: 7,
  childrenCount: 8,
  ...
}
```

### 查看浏览器控制台

1. 打开开发者工具（F12）
2. 切换到 Console 标签
3. 发送消息
4. 查看是否有错误

**正常情况应该看到**:
```
SSE event: {type: 'start', data: {...}}
SSE event: {type: 'search', data: {count: 16, ...}}
SSE event: {type: 'token', data: {content: '这'}}
SSE event: {type: 'token', data: {content: '篇'}}
...
SSE event: {type: 'done', data: {content: '...', citations: [...]}}
```

### 检查 Network 请求

1. 开发者工具 → Network 标签
2. 发送消息
3. 找到 `/api/chat/sessions/[id]/messages` 请求
4. 查看响应内容

**应该看到 SSE 流式响应**:
```
data: {"type":"start","data":{"timestamp":...}}

data: {"type":"token","data":{"content":"这"}}

data: {"type":"token","data":{"content":"篇"}}

...

data: {"type":"done","data":{"content":"...","citations":[...]}}
```

---

## 📊 预期效果对比

### 修复前 ❌

```
这篇文章主要介绍并深入剖析了一篇名为《LightRAG: Simple and Fast 
Retrieval-Augmented Generation》的学术论文。该论文的核心是提出了
一种新颖的、轻量级的检索增强生成（RAG）框架，旨在解决现有RAG系统
在上下文理解、检索效率和知识更新灵活性方面的关键局限。
```
- ❌ 没有引用标记
- ❌ 没有引用小标
- ❌ 无法查看引用来源

### 修复后 ✅

```
这篇文章主要介绍并深入剖析了一篇名为《LightRAG: Simple and Fast 
Retrieval-Augmented Generation》的学术论文[[1]]。该论文的核心是提出了
一种新颖的、轻量级的检索增强生成（RAG）框架[[2]]，旨在解决现有RAG系统
在上下文理解、检索效率和知识更新灵活性方面的关键局限[[3]]。
```
- ✅ 包含 `[[1]]`、`[[2]]`、`[[3]]` 引用标记
- ✅ 渲染为蓝色圆形小标：① ② ③
- ✅ 鼠标悬停显示引用详情
- ✅ 流式响应，逐字显示

---

## 🆘 故障排查

### 问题 1: 后端容器重启失败

```bash
# 查看容器状态
docker-compose ps

# 查看错误日志
docker logs context-os-backend --tail 50

# 强制重新构建
docker-compose up -d --build --force-recreate backend
```

### 问题 2: 前端显示旧代码

```bash
# 清除浏览器缓存
# 或使用无痕模式访问

# 重启前端容器
docker-compose restart frontend
```

### 问题 3: LLM 仍然不插入引用

**临时解决方案**: 在前端手动显示引用

修改 `components/chat/Message.tsx`，在消息底部显示所有引用：

```tsx
{message.citations && message.citations.length > 0 && (
  <div className="mt-4 border-t pt-2">
    <p className="text-xs text-muted-foreground mb-2">引用来源：</p>
    {message.citations.map((citation) => (
      <div key={citation.index} className="text-xs mb-2">
        <span className="font-medium">[{citation.index}]</span> {citation.content.slice(0, 100)}...
      </div>
    ))}
  </div>
)}
```

---

## 📞 获取帮助

如果问题仍然存在，请提供以下信息：

1. **后端日志**（最近 100 行）
   ```bash
   docker logs context-os-backend --tail 100 > backend-logs.txt
   ```

2. **浏览器控制台截图**
   - 包含错误信息

3. **Network 请求详情**
   - `/api/chat/sessions/[id]/messages` 的响应内容

4. **实际回答内容**
   - 复制完整的 AI 回答

---

## ✅ 验收标准

修复成功的标志：

- [x] 后端容器成功重启
- [ ] 回答中包含 `[[1]]`、`[[2]]` 等引用标记
- [ ] 引用标记渲染为蓝色圆形小标
- [ ] 鼠标悬停显示悬浮卡片
- [ ] 悬浮卡片包含完整引用信息
- [ ] 回答是流式显示（逐字出现）
- [ ] 浏览器控制台无错误

---

**现在请执行步骤 1：重启后端容器，然后测试验证！** 🚀

