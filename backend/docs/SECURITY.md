# Security Controls

## Authentication & Authorization
- API routes check `getCurrentUser()` and return 401 when missing.
- Protect `/api/metrics` by setting `METRICS_ENABLED=true` and requiring login.

## Request Limits
- File upload size is capped by `UPLOAD_MAX_BYTES`.
- Supported file types are validated using `isSupportedFormat`.
- Search query length is capped by `SEARCH_QUERY_MAX_CHARS`.

## Rate Limiting
- Upload endpoint: `UPLOAD_RATE_LIMIT_MAX` / `UPLOAD_RATE_LIMIT_WINDOW_MS`
- Search endpoint: `SEARCH_RATE_LIMIT_MAX` / `SEARCH_RATE_LIMIT_WINDOW_MS`

## Concurrency Limits
- Upload endpoint: `UPLOAD_CONCURRENCY_LIMIT`
- Search endpoint: `SEARCH_CONCURRENCY_LIMIT`

## Redaction
- Logs redact common secret fields, bearer tokens, and cookies.

## Response Headers
- Global security headers include `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.

## Hardening Suggestions
- Enforce per-tenant storage rules in Qdrant.
- Add request body size limits at the reverse proxy (Nginx/Caddy).
- Add IP allowlists for admin-only routes.
