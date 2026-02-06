# Environment Defaults

Defaults used when env vars are not set:
- QDRANT_URL: `http://127.0.0.1:6333`
- LITELLM_BASE_URL: `http://localhost:4000`
- EMBEDDING_MODEL: `qwen3-embedding-4b`
- RERANK_MODEL: `qwen3-reranker-4b`
- VISION_OCR_MODEL: `deepseek-ocr`

Enable strict validation in production:
```
ENV_STRICT=1
```
