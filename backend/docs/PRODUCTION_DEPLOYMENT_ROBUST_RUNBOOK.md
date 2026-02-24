# Production Deployment Runbook (Robust)

> 适用对象：当前 Context-OS 管理后台 + LiteLLM 网关 + Qdrant 双机架构。
> 目标：部署过程可门禁、可回滚、可审计。

## 1. 适用架构

- Server A：`Nginx + Context-OS API + Worker + LiteLLM + LiteLLM Postgres + Redis`
- Server B：`Qdrant`
- 域名：`contextlm.top / www.contextlm.top`

参考：`docs/DEPLOYMENT_CONTEXT.md`

---

## 2. 一次性准备（首次上生产）

### 2.1 服务器初始化

在 Server A 执行：

```bash
sudo REPO_URL=<your-git-repo-url> \
  APP_GIT_REF=main \
  ENABLE_SSL=1 \
  SSL_CERT_PATH=/etc/nginx/ssl/contextlm.top.pem \
  SSL_KEY_PATH=/etc/nginx/ssl/contextlm.top.key \
  /var/www/context-os/backend/scripts/deploy/tencent-server-a.sh
```

在 Server B 执行：

```bash
sudo /var/www/context-os/backend/scripts/deploy/tencent-server-b-qdrant.sh
```

### 2.2 填写生产密钥

必须确认以下两个文件已填入真实值：

- `/etc/context-os/context-os.env`
- `/opt/context-os/litellm/.env`

重点字段：

- 管理后台：`ADMIN_SUPER_EMAIL` / `ADMIN_SUPER_PASSWORD` / `ADMIN_REPORT_*`
- LiteLLM DB 模式：`LITELLM_MASTER_KEY` / `LITELLM_SALT_KEY` / `DATABASE_URL` / `STORE_MODEL_IN_DB=true`
- 管理后台 LiteLLM 接口：`LITELLM_ADMIN_*`、`LITELLM_USAGE_*`

模板参考：

- `scripts/templates/context-os.env`
- `scripts/templates/litellm/litellm.env.template`
- `docs/PRODUCTION_ENV_TEMPLATE.md`

---

## 3. 每次发布前 Go / No-Go 检查

在 Server A 执行（必须全通过）：

```bash
# 1) 基础服务状态
sudo systemctl is-active context-os-api context-os-worker redis-server nginx

# 2) LiteLLM 容器状态
cd /opt/context-os/litellm
sudo docker compose ps

# 3) 健康探针
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:4410/health/readiness

# 4) Qdrant 连通
QDRANT_URL=$(grep '^QDRANT_URL=' /etc/context-os/context-os.env | cut -d= -f2-)
curl -fsS "$QDRANT_URL/collections"
```

---

## 4. 标准发布流程（强门禁）

使用新脚本：`scripts/deploy/prod-rollout.sh`

### 4.1 执行发布

```bash
cd /var/www/context-os
sudo RELEASE_REF=<tag-or-commit-or-branch> \
  APP_DIR=/var/www/context-os \
  ENV_FILE=/etc/context-os/context-os.env \
  LITELLM_DIR=/opt/context-os/litellm \
  /var/www/context-os/backend/scripts/deploy/prod-rollout.sh
```

可选参数：

- `SKIP_SELFCHECK=1`：跳过 `npm run selfcheck`
- `SKIP_QDRANT_SNAPSHOT=1`：跳过 Qdrant 快照
- `SKIP_LITELLM_DB_DUMP=1`：跳过 LiteLLM DB dump

### 4.2 脚本自动做什么

- 发布前快照：
  - `context-os.env` / `litellm/.env`
  - SQLite 备份（若 `DATABASE_URL` 为本地文件）
  - Qdrant collection 快照
  - LiteLLM Postgres dump（若存在 `litellm-db`）
- 检出目标版本 + `npm ci` + `npm run build`
- 重启 `litellm-db/litellm/context-os-api/context-os-worker`
- 健康门禁：
  - `GET /api/health == 200`
  - `LiteLLM readiness == 200`
  - `GET /api/admin/auth/me` 返回 `200` 或 `401`
- 写入发布记录：`/var/lib/context-os/deploy/releases/<timestamp>.env`

---

## 5. 发布后验收（管理后台）

### 5.1 页面与权限

- `https://<domain>/admin/login` 可打开
- 超级管理员可见：`数据报表 / 能力路由 / 模型管理`
- 报表管理员只可见：`数据报表`

### 5.2 核心 API 验收

```bash
# 管理认证接口可达（未登录预期 401）
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/admin/auth/me

# LiteLLM 模型列表
curl -sS -H "Authorization: Bearer <LITELLM_ADMIN_API_KEY>" \
  http://127.0.0.1:4410/v1/models | head
```

### 5.3 LiteLLM 用量接口

如果出现 `DB not connected`，优先检查：

- LiteLLM 容器是否带 `DATABASE_URL`
- `STORE_MODEL_IN_DB=true`
- `LITELLM_MASTER_KEY` 是否与后台配置一致

---

## 6. 回滚流程（10分钟内恢复）

使用新脚本：`scripts/deploy/prod-rollback.sh`

### 6.1 按最近一次发布记录回滚

```bash
sudo RECORD_FILE=/var/lib/context-os/deploy/latest.env \
  /var/www/context-os/backend/scripts/deploy/prod-rollback.sh
```

### 6.2 指定回滚版本

```bash
sudo RECORD_FILE=/var/lib/context-os/deploy/latest.env \
  ROLLBACK_REF=<previous-tag-or-commit> \
  /var/www/context-os/backend/scripts/deploy/prod-rollback.sh
```

### 6.3 可选控制项

- `RESTORE_ENV=0`：不恢复环境文件
- `RESTORE_SQLITE=0`：不恢复 SQLite
- `RESTORE_QDRANT=0`：不恢复 Qdrant snapshot
- `RESTORE_LITELLM_DB=0`：不恢复 LiteLLM Postgres
- `SKIP_NPM_CI=1`：回滚时跳过 npm ci

### 6.4 回滚后门禁

脚本会自动校验：

- `/api/health` = 200
- LiteLLM readiness = 200
- `/api/admin/auth/me` = 200 或 401

---

## 7. 监控与告警建议

发布后至少观察 2 小时：

```bash
# API / Worker
sudo tail -f /var/log/context-os/api.log
sudo tail -f /var/log/context-os/worker.log

# LiteLLM
cd /opt/context-os/litellm
sudo docker compose logs -f --tail=200 litellm litellm-db

# Nginx
sudo tail -f /var/log/nginx/context-os-error.log
```

建议触发自动回滚的阈值：

- 连续 3 次健康探针失败
- 管理后台登录连续 5 分钟不可用
- LiteLLM readiness 连续失败超过 3 分钟

---

## 8. 日常运维速查

```bash
# 重启服务
sudo systemctl restart context-os-api context-os-worker
cd /opt/context-os/litellm && sudo docker compose restart

# 查看最近发布记录
ls -1 /var/lib/context-os/deploy/releases | tail -n 5
readlink -f /var/lib/context-os/deploy/latest.env

# 快速健康检查
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:4410/health/readiness
```

---

## 9. 说明

本 Runbook 已覆盖以下历史问题：

- `tencent-server-a.sh` 的 `REPO_URL=REPLACE_ME` 阻断
- LiteLLM 模板缺失 `.env` 导致部署中断
- LiteLLM 未带数据库时，模型 CRUD 与用量报表不可用
- 前端容器构建缺少 standalone 产物导致镜像失败
