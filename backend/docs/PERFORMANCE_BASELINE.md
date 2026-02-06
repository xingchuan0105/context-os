# Performance Baseline

Latest load test summary:
- Script: `scripts/load-test-rag.ts`
- Report: `scripts/load-test-report.json`
- Concurrency: 5
- Requests: 20

Results:
- Success rate: 100%
- Avg: 1594.9 ms
- P50: 947 ms
- P95: 3702 ms
- Min: 790 ms
- Max: 3702 ms

Notes:
- The script auto-selects the latest user/kb if none specified.
- If you need a fixed dataset, set `LOAD_USER_ID` and `LOAD_KB_ID`.
