import 'dotenv/config'

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { initializeDatabase, db } from '../lib/db/schema'
import { getDocumentsByKbId } from '../lib/db/queries'
import { ragRetrieve } from '../lib/rag/retrieval'

type LoadTestResult = {
  requestId: number
  query: string
  success: boolean
  durationMs: number
  error?: string
}

const CONCURRENCY = parseInt(process.env.LOAD_CONCURRENCY || '5', 10)
const TOTAL_REQUESTS = parseInt(process.env.LOAD_REQUESTS || '20', 10)
const REPORT_FILE = process.env.LOAD_REPORT_FILE || 'scripts/load-test-report.json'

const USER_ID = process.env.LOAD_USER_ID || ''
const KB_ID = process.env.LOAD_KB_ID || ''
const DOC_IDS = process.env.LOAD_DOC_IDS?.split(',').map((s) => s.trim()).filter(Boolean) || []
const QUERY_FILE = process.env.LOAD_QUERIES_FILE || ''
const QUERIES =
  process.env.LOAD_QUERIES?.split('|').map((s) => s.trim()).filter(Boolean) ||
  ['Explain write amplification and why it matters.']

function loadQueriesFromFile(path: string): string[] {
  if (!path) return []
  try {
    const raw = readFileSync(resolve(process.cwd(), path), 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      return data.map((entry) => String(entry))
    }
    if (Array.isArray(data?.questions)) {
      return data.questions.map((entry: any) => String(entry.question || entry.text || entry))
    }
  } catch {
    return []
  }
  return []
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx]
}

async function resolveUserAndKb(): Promise<{ userId: string; kbId: string; docIds: string[] }> {
  initializeDatabase()
  let userId = USER_ID
  let kbId = KB_ID

  if (!userId) {
    const user = db.prepare('SELECT id FROM users ORDER BY created_at DESC LIMIT 1').get() as any
    userId = user?.id || ''
  }

  if (!kbId) {
    const kb = db
      .prepare('SELECT id FROM knowledge_bases WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(userId) as any
    kbId = kb?.id || ''
  }

  let docIds = DOC_IDS
  if (docIds.length === 0 && kbId) {
    const docs = await getDocumentsByKbId(kbId)
    docIds = docs.map((doc) => doc.id)
  }

  if (!userId || !kbId || docIds.length === 0) {
    throw new Error('Missing userId/kbId/docIds for load test')
  }

  return { userId, kbId, docIds }
}

async function main() {
  const fileQueries = loadQueriesFromFile(QUERY_FILE)
  const queries = fileQueries.length > 0 ? fileQueries : QUERIES
  if (queries.length === 0) {
    throw new Error('No queries provided')
  }

  const { userId, kbId, docIds } = await resolveUserAndKb()
  const results: LoadTestResult[] = []

  let inFlight = 0
  let issued = 0
  let finished = 0

  await new Promise<void>((resolveAll) => {
    const runNext = () => {
      while (inFlight < CONCURRENCY && issued < TOTAL_REQUESTS) {
        const requestId = issued++
        const query = queries[requestId % queries.length]
        inFlight += 1

        const start = Date.now()
        ragRetrieve(userId, query, {
          kbId,
          documentIds: docIds,
          documentLimit: 6,
          documentTopK: 3,
          parentLimit: 10,
          childLimit: 8,
          childLimitFromDocs: 8,
          childLimitGlobal: 8,
          childTopK: 8,
          scoreThreshold: 0.3,
          rerank: true,
          enableDocRouting: false,
        })
          .then(() => {
            results.push({ requestId, query, success: true, durationMs: Date.now() - start })
          })
          .catch((error) => {
            results.push({
              requestId,
              query,
              success: false,
              durationMs: Date.now() - start,
              error: error instanceof Error ? error.message : String(error),
            })
          })
          .finally(() => {
            inFlight -= 1
            finished += 1
            if (finished >= TOTAL_REQUESTS) {
              resolveAll()
              return
            }
            runNext()
          })
      }
    }

    runNext()
  })

  const durations = results.map((r) => r.durationMs)
  const successCount = results.filter((r) => r.success).length
  const report = {
    total: results.length,
    success: successCount,
    successRate: results.length > 0 ? successCount / results.length : 0,
    avgMs: durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length),
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: Math.max(...durations),
    minMs: Math.min(...durations),
    results,
  }

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))
  console.log(`[load-test] report saved to ${REPORT_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
