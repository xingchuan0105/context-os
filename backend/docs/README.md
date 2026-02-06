# Context-OS

一个基于 RAG (检索增强生成) 的智能知识管理系统，支持文档上传、智能检索和自然语言对话。

## 功能特性

- **文档管理**: 上传 PDF、DOCX、TXT、Markdown 等格式
- **智能检索**: 基于向量数据库的语义搜索
- **AI 对话**: 结合检索结果的智能问答
- **知识库**: 组织和管理个人/团队知识

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript
- **后端**: Next.js API Routes
- **数据库**: SQLite + Qdrant (向量数据库)
- **AI**: LiteLLM 网关 (支持 DeepSeek、Qwen 等模型)

## 文档

- [架构说明](ARCHITECTURE.md)
- [开发指南](DEVELOPMENT.md)
- [代码地图](CODEMAP.md)
- [更新日志](CHANGELOG.md)
