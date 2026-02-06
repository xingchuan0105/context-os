# Context-OS Clean Workspace (2026-01-29, v3)

此目录是一个“干净拷贝”的工作区，用于整理版本与减少上下文混乱。

结构：
- `backend/`  ← 来自 `D:\context-os\context-os`
- `frontend/` ← 来自 `D:\context-os\context-os-front-end`

已做清理：
- 排除 `node_modules/`、`.next/`、`data/`、`qdrant_storage/`、`redis_data/` 等运行时目录
- 排除 `.git/`、`.vscode/`、`.claude/`、`.tools/`
- 排除 `.env` 与 `.env.local`
- 排除大体积样例资产（`.zip`/`.pdf`/`.pptx`）
- 文档统一转为 UTF-8

入口文档：
- `backend/docs/PROJECT_LATEST.md`

下一步：
1) 复制 `backend/.env.example` → `backend/.env` 并补齐密钥
2) 使用 Docker 或本地模式启动后端与前端
