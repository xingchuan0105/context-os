#!/usr/bin/env tsx
import './worker-env'
import { ingestWorker } from '../lib/worker-qdrant'
import { getRedisInfo } from '../lib/queue'

const redisInfo = getRedisInfo()
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '1', 10)
const qdrantUrl = process.env.QDRANT_URL || 'http://127.0.0.1:6333'

console.log(`[worker] start`)
console.log(`[worker] redis=${redisInfo.host}:${redisInfo.port} db=${redisInfo.db ?? 'default'}`)
console.log(`[worker] concurrency=${Math.max(1, concurrency)}`)
console.log(`[worker] qdrant=${qdrantUrl}`)

ingestWorker.on('ready', () => {
  console.log('[worker] ready')
})

ingestWorker.on('active', (job) => {
  console.log(`[worker] job active id=${job.id}`)
})

ingestWorker.on('completed', (job) => {
  console.log(`[worker] job completed id=${job.id}`)
})

ingestWorker.on('failed', (job, err) => {
  console.error(`[worker] job failed id=${job?.id} error=${err.message}`)
})

ingestWorker.on('error', (err) => {
  console.error(`[worker] error: ${err.message}`)
})

const shutdown = async () => {
  console.log('[worker] shutting down...')
  await ingestWorker.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
