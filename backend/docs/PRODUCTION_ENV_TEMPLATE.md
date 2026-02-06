# Production Environment Template (Coolify Secrets)
Use this template to configure secrets and environment variables in Coolify. Do not commit real keys into the repo or .env files.

## Context OS (Next.js API)
```
NODE_ENV=production
DATABASE_URL=./data/context-os.db
JWT_SECRET=your-strong-secret

# Qdrant
QDRANT_URL=http://qdrant:6333
QDRANT_TIMEOUT_MS=60000
QDRANT_INDEXING_THRESHOLD=20000
QDRANT_HNSW_M=16
QDRANT_HNSW_EF_CONSTRUCT=128
QDRANT_ON_DISK=false
QDRANT_UPSERT_BATCH_SIZE=500

# LiteLLM
LITELLM_BASE_URL=http://litellm:4000
LITELLM_API_KEY=sk-your-litellm-key-here

# Models
EMBEDDING_MODEL=qwen3-embedding-4b
RERANK_MODEL=qwen3-reranker-4b
RERANK_TIMEOUT_MS=30000
VISION_OCR_MODEL=deepseek-ocr

# Parser/Office
PYMUPDF_ENABLED=true
LIBREOFFICE_BIN=soffice
OFFICE_CONVERT_TIMEOUT_MS=120000
POPPLER_PATH=/usr/bin

# Chunking
DOC_CHUNK_SIZE=2400
DOC_CHUNK_OVERLAP=300
PARENT_CHUNK_SIZE=1600
PARENT_CHUNK_OVERLAP=240
CHILD_CHUNK_SIZE=420
CHILD_CHUNK_OVERLAP=100
KTYPE_MAX_TOKENS=500000

# Limits
UPLOAD_MAX_BYTES=52428800
UPLOAD_CONCURRENCY_LIMIT=2
UPLOAD_RATE_LIMIT_MAX=0
UPLOAD_RATE_LIMIT_WINDOW_MS=60000
SEARCH_CONCURRENCY_LIMIT=5
SEARCH_RATE_LIMIT_MAX=0
SEARCH_RATE_LIMIT_WINDOW_MS=60000
SEARCH_QUERY_MAX_CHARS=1000

# Observability
METRICS_ENABLED=false
LOG_SINK_URL=
LOG_SINK_LEVEL=error
LOG_SINK_TIMEOUT_MS=3000

# Env Validation
ENV_STRICT=1
```

## LiteLLM (Model Gateway)
```
SILICONFLOW_API_KEY=sk-your-siliconflow-api-key-here
DASHSCOPE_API_KEY=sk-your-dashscope-api-key-here
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
```

## Optional: Direct Embedding (Bypass LiteLLM)
```
EMBEDDING_API_KEY=sk-your-embedding-api-key-here
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_TIMEOUT_MS=120000
```

## Optional: OneAPI (if still used)
```
ONEAPI_BASE_URL=http://oneapi:3000/v1
ONEAPI_API_KEY=sk-your-oneapi-api-key-here
```

## Notes
- Keep all secrets in Coolify Secrets.
- Adjust limits and batch sizes based on your traffic and Qdrant capacity.
