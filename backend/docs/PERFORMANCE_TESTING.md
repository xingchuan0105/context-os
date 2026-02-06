# Performance & Load Testing

Use `scripts/load-test-rag.ts` to validate concurrency limits and response latency.

## Quick Run
```
LOAD_CONCURRENCY=5 \
LOAD_REQUESTS=20 \
LOAD_USER_ID=your-user-id \
LOAD_KB_ID=your-kb-id \
node scripts/load-test-rag.ts
```

## Optional Inputs
- `LOAD_DOC_IDS` (comma-separated) to scope retrieval
- `LOAD_QUERIES` (pipe-separated) e.g. `Q1|Q2|Q3`
- `LOAD_QUERIES_FILE` (JSON array or `{ "questions": [...] }`)
- `LOAD_REPORT_FILE` output path

## Recommended Limits
- Tune `SEARCH_CONCURRENCY_LIMIT` and `SEARCH_RATE_LIMIT_MAX` to protect the API.
- Tune `QDRANT_UPSERT_BATCH_SIZE` for ingestion throughput.

## Baseline
See `docs/PERFORMANCE_BASELINE.md` for the latest load test summary.
