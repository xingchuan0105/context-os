# CI/CD Pipeline

## CI (GitHub Actions)
Workflow: `.github/workflows/ci.yml`
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run ci:smoke`

The smoke test uses `test-document.txt` and does not call external APIs.
Typecheck is skipped by default unless `TYPECHECK_STRICT=1`.

## Startup Self-Check
Script: `scripts/startup-selfcheck.ts`
- Validates required env vars via `ENV_STRICT`.
- Checks Qdrant health.
- Checks LiteLLM `/v1/models`.

Run locally:
```
npm run selfcheck
```

Skip external checks:
```
SELF_CHECK_SKIP_EXTERNAL=1 npm run selfcheck
```

## Build & Start
```
npm run build
npm run start
```

Then run self-check to verify dependencies.
