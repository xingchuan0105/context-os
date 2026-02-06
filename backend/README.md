# Context-OS

> 基于 RAG (检索增强生成) 的智能知识管理系统

## 功能特性

- **文档管理** - 上传 PDF、DOCX、TXT、Markdown 等格式
- **智能检索** - 基于向量数据库的语义搜索
- **AI 对话** - 结合检索结果的智能问答
- **知识库** - 组织和管理个人/团队知识

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [开发指南](docs/DEVELOPMENT.md)
- [代码地图](docs/CODEMAP.md)
- [更新日志](docs/CHANGELOG.md)

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript
- **后端**: Next.js API Routes
- **数据库**: SQLite + Qdrant (向量数据库)
- **AI**: LiteLLM 网关 (支持 DeepSeek、Qwen 等模型)

## 许可证

MIT
