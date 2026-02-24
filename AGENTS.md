# Context for Codex Agents

This repository is maintained by a **single human owner + Codex (and subagents)**.
Treat this file as persistent operating context for all future upgrade/release tasks.

## Top priorities

1. Keep production stable.
2. Keep deploy changes auditable.
3. Never mix experimental work into release commits.

## Release hygiene (mandatory)

- Use a dedicated branch for each release/hotfix (example: `release/YYYYMMDD-hotfix`).
- Stage files with an explicit whitelist; do not use `git commit -a`.
- Do not include these paths in release commits:
  - `backend/venv/**`
  - `backend/redis_data/**`
  - `backend/logs/**`
  - `frontend/logs/**`
  - `backend/experiments/**`
  - local diff artifacts (for example `*.diff`)

## Deployment source of truth

- Primary runbook: `backend/docs/PRODUCTION_DEPLOYMENT_ROBUST_RUNBOOK.md`
- Deployment script: `backend/scripts/deploy/prod-rollout.sh`
- Rollback script: `backend/scripts/deploy/prod-rollback.sh`

When asked to deploy, prefer using the scripts above. Do not invent ad-hoc production steps unless blocked.

## Pre-release gates (must pass)

Before any production release recommendation, verify:

1. `npm ci`
2. `npm run build`
3. service health checks defined in runbook
4. compose/service config sanity (ports, env, DB path)

If a gate fails, stop release guidance and provide fix-first steps.

## Hotfix handling

If a server-side hotfix is applied manually:

1. backport to repo immediately;
2. commit with minimal file scope;
3. document root cause + prevention in docs;
4. provide rollback command path.

## Environment pitfalls to re-check

- `NEXT_PUBLIC_APP_URL` must point to real domain in production context.
- Database path consistency (`DATABASE_URL`) must match expected historical data location.
- SQLite file ownership/permissions must allow runtime user writes.
- Avoid local virtualenv files in Docker build context (`venv`/`.venv` excluded).

## Response style for this repo

- Be concise, factual, and execution-oriented.
- For deployment tasks, always output:
  1. exact commands,
  2. verification commands,
  3. rollback commands.

