# Changelog

本文记录 Context-OS 的所有重要变更。

格��基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [Unreleased]

### Added
- **Docker 开发环境**
  - `docker-compose.dev.yml` - 完整的开发环境编排
  - `Dockerfile.backend` - 后端 API 服务镜像
  - `Dockerfile.worker` - 文档处理 Worker 镜像
  - 服务端口: backend(3002), frontend(3003), litellm(4410)
- **密码重置功能**
  - `app/api/auth/reset-request/` - 请求重置邮件
  - `app/api/auth/verify-reset-token/` - 验证重置 Token
  - `app/api/auth/reset-password/` - 执行密码重置
- **邮件服务** (`lib/email/`)
  - SMTP 邮件发送支持
  - 密码重置邮件模板
- **K-Type 文档处理优化**
  - 切块流程优化 (semchunk + fallback)
  - 内存管理改进 (GC 控制、流式处理)
  - 父子分块策略 (parent: 1600 chars, child: 420 chars)
- 代码安全审计修复
  - JWT 密钥默认值漏洞修复
  - 密码哈希升级 (600,000 迭代 + 异步)
  - 用户注册输入验证 (Zod)
  - Redis 速率限制
  - 文件类型 Magic Bytes 验证
  - Markdown XSS 防护 (DOMPurify)
- 环境变量统一解析工具 (`lib/config/env-helpers.ts`)
- 文件验证工具 (`lib/utils/file-validation.ts`)
- 共享格式化工具函数

### Fixed
- debugLog 递归调用栈溢出
- 前端 Token 提取逻辑重复
- Mock 数据默认值问题
- 未使用的导入和死代码

### Security
- CSRF 保护 (待实现)

---

## [0.1.0] - 2025-01-27

### Added
- 初始版本发布
- 用户认证系统 (注册/登录/JWT)
- 文档上传和处理
  - PDF 解析 (PyMuPDF)
  - DOCX 解析
  - 网页内容抓取
- RAG 聊天功能
  - K-Type 认知分析
  - 向量嵌入 (Qwen3-embedding)
  - 父子分块策略
- 知识库管理
- 来源引用和追踪
- 多模型支持 (DeepSeek、Qwen)

### Known Issues
- 前后端端口配置分散
- 缺少版本变更追踪
- 临时文件未清理
