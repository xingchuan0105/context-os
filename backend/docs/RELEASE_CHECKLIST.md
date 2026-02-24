# Release Checklist (Single-Operator + Codex)

> Purpose: provide deterministic release steps for the repo owner and Codex agents.

## 0) Scope freeze

- [ ] Confirm release goal and excluded scope (especially experiments).
- [ ] Create release branch from latest stable main.
- [ ] Confirm commit whitelist before any staging.

---

## 1) Local code gates

- [ ] `npm ci`
- [ ] `npm run build`
- [ ] Confirm no accidental file drift in release commit scope.

Recommended status check:

```bash
git status --short
git diff --name-only
```

---

## 2) Release commit hygiene

- [ ] Stage only release files (explicit `git add <file...>`).
- [ ] Ensure no `venv`, `redis_data`, logs, experiments, diff artifacts.
- [ ] Create clear commit messages:
  - fix commit(s)
  - deploy/process commit(s)

Validation:

```bash
git diff --cached --name-only
```

---

## 3) Server preflight (Go / No-Go)

- [ ] API/worker/nginx/system services active.
- [ ] LiteLLM and dependencies healthy.
- [ ] Qdrant reachable.
- [ ] Ports are not occupied by stale containers.

---

## 4) Production rollout

- [ ] Use `backend/scripts/deploy/prod-rollout.sh` with explicit `RELEASE_REF`.
- [ ] Confirm script generated release record in `/var/lib/context-os/deploy/releases/`.
- [ ] Run smoke tests:
  - `/api/health`
  - `/api/admin/auth/me` (200/401 acceptable unauthenticated)
  - `/admin/login`
  - LiteLLM readiness endpoint

---

## 5) Post-release validation

- [ ] Admin login works from domain.
- [ ] Data reports read expected DB records (not empty due to wrong DB path).
- [ ] Capability model test works with saved key/model config.
- [ ] No 5xx spikes in API/LiteLLM/nginx logs.

---

## 6) Rollback readiness

- [ ] Verify latest release record path.
- [ ] Verify rollback script command is ready:
  - `backend/scripts/deploy/prod-rollback.sh`
- [ ] Verify backup artifacts exist (env/sqlite/qdrant/litellm dump when enabled).

---

## 7) Incident backport protocol (if hotfix happened on server)

- [ ] Convert server hotfix into minimal repo patch immediately.
- [ ] Commit only operationally relevant files.
- [ ] Update runbook/checklist with prevention item.
- [ ] Record root cause and verification evidence.

