# Release Checklist

## Environment
- Fill `docs/PRODUCTION_ENV_TEMPLATE.md` and set secrets in Coolify.
- Set `ENV_STRICT=1` for production validation.
- Verify `QDRANT_URL` and `LITELLM_BASE_URL` are reachable from the app.

## Services
- Qdrant healthy: `GET /` returns `qdrant`.
- LiteLLM healthy: verify `/v1/models` (or internal health endpoint).
- Storage path writable (`DATABASE_URL` location and local file storage).

## Smoke
- Run `scripts/e2e-ingest-and-recall.ts` once with a small test file.
- Confirm output report at `scripts/e2e-report.json`.
- Run `npm run selfcheck` to verify external dependencies.

## Performance
- Run `scripts/load-test-rag.ts` and record the baseline in `docs/PERFORMANCE_BASELINE.md`.

## Observability
- Check request logs include `x-request-id`.
- If `METRICS_ENABLED=true`, verify `GET /api/metrics`.

## Backup
- Create initial SQLite backup.
- Create Qdrant snapshot for each collection.

## Rollback
- Keep previous container image tag.
- Keep matching SQLite + Qdrant snapshot for rollback.
