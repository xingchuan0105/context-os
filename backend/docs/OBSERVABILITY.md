# Observability

This project includes lightweight request logging, error reporting, and in-memory metrics.

## Request Logs
- Each request receives an `x-request-id` header (set in `middleware.ts`).
- Each request receives an `x-trace-id` and `traceparent` header for trace propagation.
- `withErrorHandler` logs one line per request with method, path, status, duration.
- Error stacks are logged with the same request ID.

## Metrics
Metrics are recorded in memory and exposed via `/api/metrics` when enabled.

Captured timings:
- `parse` (document parsing)
- `embedding`
- `qdrant_upsert`
- `rag`
- `llm_chat` / `llm_stream`

Captured counters:
- `api_error`
- `parse_error`
- `document_process_error`
- `qdrant_upsert_error`
- `rag_error`
- `llm_error`

Enable metrics endpoint:
```
METRICS_ENABLED=true
```

Fetch snapshot:
```
GET /api/metrics
```

## Redaction
Logs are sanitized for common secret fields (`authorization`, `api_key`, `token`, `secret`, etc.).

## External Log Sink (Optional)
Send structured logs to an external endpoint:
```
LOG_SINK_URL=https://your-log-endpoint
LOG_SINK_LEVEL=error
LOG_SINK_TIMEOUT_MS=3000
```
