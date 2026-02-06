# E2E Baseline

This baseline captures the latest end-to-end run.

Run metadata:
- Script: `scripts/e2e-ingest-and-recall.ts`
- Report file: `scripts/e2e-report.json`
- Note: current run executed after resetting user data.

Baseline summary:
- runId: d43e5b68-1187-4695-8f59-ae23318c0f90
- startedAt: 2026-01-16T03:09:50.225Z
- finishedAt: 2026-01-16T03:33:14.410Z
- RAG duration: 2373 ms
- LLM duration: 13479 ms

Coverage:
- Ingested documents: `test3` only (3 parts)
- `test` and `test2` were skipped due to prior state reuse.

If full coverage is required, re-run with `E2E_RESET=1`.
