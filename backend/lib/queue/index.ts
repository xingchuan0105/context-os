import { Queue, Worker, type Job, type JobsOptions } from 'bullmq'

export type IngestJobData = {
  docId: string
}

const QUEUE_NAME = 'ingest'
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined
const REDIS_DB = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined

const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  maxRetriesPerRequest: null,
}

const defaultJobOptions: JobsOptions = {
  removeOnComplete: 100,
  removeOnFail: 100,
}

export const ingestQueue = new Queue<IngestJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions,
})

export function enqueueDocumentIngest(docId: string, options: JobsOptions = {}) {
  return ingestQueue.add(
    'ingest-document',
    { docId },
    {
      jobId: `doc-${docId}`,
      ...options,
    }
  )
}

export function createIngestWorker(
  handler: (job: Job<IngestJobData>) => Promise<void>
): Worker<IngestJobData> {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '1', 10)
  return new Worker<IngestJobData>(QUEUE_NAME, handler, {
    connection,
    concurrency: Math.max(1, concurrency),
  })
}

export function getRedisInfo() {
  return {
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: REDIS_DB,
  }
}
