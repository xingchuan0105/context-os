import 'dotenv/config'

if (!process.env.EMBEDDING_MODEL) {
  process.env.EMBEDDING_MODEL = 'qwen3-embedding-4b'
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { initializeDatabase, db } from '../lib/db/schema'
import { createKnowledgeBase, createDocument, type Document } from '../lib/db/queries'
import { deleteUserCollection, healthCheck } from '../lib/qdrant'
import { processDocumentWithText } from '../lib/processors/document-processor'
import { parseFile, formatAsMarkdown, toMarkdownFileName } from '../lib/parsers'
import { uploadMarkdownToLocal } from '../lib/storage/local'
import { ragRetrieve } from '../lib/rag/retrieval'
import { createLLMClient } from '../lib/llm-client'

const TEST_USER_EMAIL = 'auto-rag@example.com'
const TEST_KB_TITLE = 'Auto RAG KB'
const DOC_FILES =
  process.env.DOC_FILES?.split(',').map((s) => s.trim()).filter(Boolean) ||
  ['test.pdf', 'test2.pdf', 'test3.pdf']

const STATE_FILE = process.env.E2E_STATE_FILE || 'scripts/.e2e-state.json'
const REPORT_FILE = process.env.E2E_REPORT_FILE || 'scripts/e2e-report.json'
const RESET_STATE = process.env.E2E_RESET === '1'

const MAX_RETRIES = parseInt(process.env.E2E_RETRY || '2', 10)
const RETRY_BASE_MS = parseInt(process.env.E2E_RETRY_BASE_MS || '1500', 10)

const TIMEOUT_PARSE_MS = parseInt(process.env.E2E_TIMEOUT_PARSE_MS || '120000', 10)
const TIMEOUT_INGEST_MS = parseInt(process.env.E2E_TIMEOUT_INGEST_MS || String(20 * 60 * 1000), 10)
const TIMEOUT_RAG_MS = parseInt(process.env.E2E_TIMEOUT_RAG_MS || '120000', 10)
const TIMEOUT_LLM_MS = parseInt(process.env.E2E_TIMEOUT_LLM_MS || '180000', 10)

const RUN_LLM_ANSWER = process.env.SMOKE_RUN_LLM !== '0'
const SMOKE_QUERY = process.env.SMOKE_QUERY || 'What is encapsulation?'

const KTYPE_THRESHOLD = 900000
const KTYPE_CHUNK_SIZE = 500000
const KTYPE_OVERLAP = 10000
const TOPK_CHILD = 5

const nowIso = () => new Date().toISOString()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safeWriteJson(path: string, data: unknown) {
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  writeFileSync(path, JSON.stringify(data, null, 2))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let attempt = 0
  let lastError: unknown
  while (attempt <= MAX_RETRIES) {
    try {
      if (attempt > 0) {
        const delay = Math.min(8000, RETRY_BASE_MS * Math.pow(2, attempt - 1))
        console.warn(`[retry] ${label} attempt ${attempt}/${MAX_RETRIES}, waiting ${delay}ms`)
        await sleep(delay)
      }
      return await fn()
    } catch (err) {
      lastError = err
      attempt += 1
    }
  }
  throw lastError
}

function startHeartbeat(label: string, intervalMs = 30000) {
  const started = Date.now()
  const timer = setInterval(() => {
    const elapsed = Math.round((Date.now() - started) / 1000)
    console.log(`[heartbeat] ${label} running, elapsed ${elapsed}s`)
  }, intervalMs)
  return () => clearInterval(timer)
}

type StepStatus = 'pending' | 'success' | 'failed'

interface StepState {
  status: StepStatus
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  error?: string
}

interface DocState {
  file: string
  docIds: string[]
  steps: Record<string, StepState>
}

interface E2EState {
  runId: string
  startedAt: string
  docs: Record<string, DocState>
  timings: Record<string, number[]>
}

function loadState(): E2EState {
  if (RESET_STATE || !existsSync(STATE_FILE)) {
    return {
      runId: uuidv4(),
      startedAt: nowIso(),
      docs: {},
      timings: {},
    }
  }
  try {
    const raw = readFileSync(STATE_FILE, 'utf-8')
    return JSON.parse(raw) as E2EState
  } catch {
    return {
      runId: uuidv4(),
      startedAt: nowIso(),
      docs: {},
      timings: {},
    }
  }
}

function saveState(state: E2EState) {
  safeWriteJson(STATE_FILE, state)
}

function ensureDocState(state: E2EState, file: string): DocState {
  if (!state.docs[file]) {
    state.docs[file] = {
      file,
      docIds: [],
      steps: {},
    }
  }
  return state.docs[file]
}

function recordTiming(state: E2EState, name: string, durationMs: number) {
  if (!state.timings[name]) {
    state.timings[name] = []
  }
  state.timings[name].push(durationMs)
}

async function runStep<T>(
  state: E2EState,
  docState: DocState,
  step: string,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = nowIso()
  docState.steps[step] = { status: 'pending', startedAt }
  saveState(state)

  const start = Date.now()
  try {
    const result = await fn()
    const durationMs = Date.now() - start
    docState.steps[step] = {
      status: 'success',
      startedAt,
      finishedAt: nowIso(),
      durationMs,
    }
    recordTiming(state, step, durationMs)
    saveState(state)
    return result
  } catch (err) {
    const durationMs = Date.now() - start
    docState.steps[step] = {
      status: 'failed',
      startedAt,
      finishedAt: nowIso(),
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    }
    recordTiming(state, step, durationMs)
    saveState(state)
    throw err
  }
}

async function resetTestData(userId: string) {
  try {
    db.prepare('DELETE FROM documents WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM knowledge_bases WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  } catch (err) {
    console.warn('[reset] cleanup DB failed:', err instanceof Error ? err.message : err)
  }
  try {
    await deleteUserCollection(userId)
  } catch (err) {
    console.warn('[reset] delete Qdrant collection failed:', err instanceof Error ? err.message : err)
  }
}

async function ensureUser() {
  initializeDatabase()
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(TEST_USER_EMAIL) as any
  if (existing) {
    console.log(`[setup] existing test user found, cleaning up (userId=${existing.id})`)
    await resetTestData(existing.id)
  }

  const id = uuidv4()
  db.prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(
    id,
    TEST_USER_EMAIL,
    'test-hash',
    'Auto RAG User'
  )
  console.log(`[setup] created user: ${id}`)
  return { id, email: TEST_USER_EMAIL }
}

async function ensureKb(userId: string) {
  let kb = db
    .prepare('SELECT * FROM knowledge_bases WHERE user_id = ? AND title = ?')
    .get(userId, TEST_KB_TITLE) as any
  if (!kb) {
    kb = await createKnowledgeBase(userId, TEST_KB_TITLE, undefined, 'Auto ingest KB')
    console.log(`[setup] created KB ${kb.id}`)
  } else {
    console.log(`[setup] using existing KB ${kb.id}`)
  }
  return kb
}

function splitForKType(text: string): string[] {
  if (text.length <= KTYPE_THRESHOLD) {
    return [text]
  }

  const chunks: string[] = []
  const chunkCount = Math.max(1, Math.ceil(text.length / KTYPE_CHUNK_SIZE))
  const step = KTYPE_CHUNK_SIZE - KTYPE_OVERLAP

  for (let i = 0; i < chunkCount; i++) {
    const start = i === 0 ? 0 : i * step
    const end = i === chunkCount - 1 ? text.length : start + KTYPE_CHUNK_SIZE
    chunks.push(text.slice(start, Math.min(text.length, end)))
  }

  return chunks
}

async function ingestDocs(state: E2EState, userId: string, kbId: string) {
  const docIds: string[] = []
  for (const file of DOC_FILES) {
    const docState = ensureDocState(state, file)
    if (docState.steps.ingest?.status === 'success' && docState.docIds.length > 0) {
      console.log(`[ingest] skip ${file}, already ingested (${docState.docIds.length} parts)`)
      docIds.push(...docState.docIds)
      continue
    }

    const abs = resolve(process.cwd(), file)
    const buffer = readFileSync(abs)
    console.log(`\n[ingest] parsing ${file}`)

    const parseResult = await runStep(state, docState, 'parse', () =>
      withRetry('parse', () => withTimeout(parseFile(buffer, 'application/pdf', file), TIMEOUT_PARSE_MS, 'parse'))
    )

    const ktypeInputs = splitForKType(parseResult.content)
    const baseName = toMarkdownFileName(file).replace(/\.md$/i, '')
    console.log(`[ingest] pre-split for ktype: ${ktypeInputs.length} parts, length=${parseResult.content.length}`)

    const docPartIds: string[] = []

    for (let i = 0; i < ktypeInputs.length; i++) {
      const partLabel = ktypeInputs.length > 1 ? `#part-${i + 1}-of-${ktypeInputs.length}` : ''
      const partName = `${baseName}${partLabel}.md`
      const partContent = ktypeInputs[i]
      const markdown = formatAsMarkdown(
        partContent,
        ktypeInputs.length > 1 ? `${file} ${partLabel}` : file,
        parseResult.metadata
      )

      const uploadResult = await runStep(state, docState, 'upload', () =>
        withRetry('upload', () => uploadMarkdownToLocal(userId, kbId, partName, markdown))
      )

      const doc = (await createDocument(
        kbId,
        userId,
        partName,
        uploadResult.path || `local://${userId}/${kbId}/${Date.now()}_${partName}`,
        uploadResult.base64Content || null,
        'text/markdown',
        Buffer.byteLength(markdown, 'utf-8')
      )) as Document

      docPartIds.push(doc.id)
      console.log(`[ingest] created doc record ${doc.id} (${partName})`)

      await runStep(state, docState, 'process', async () => {
        const stopHeartbeat = startHeartbeat(partName)
        try {
          const result = await withRetry('process', () =>
            withTimeout(
              processDocumentWithText(doc, partContent, {}, (p) => {
                console.log(`[ingest] ${partName} ${p.status} ${p.progress}% ${p.message || ''}`)
              }),
              TIMEOUT_INGEST_MS,
              partName
            )
          )

          if (!result.success) {
            throw new Error(`process failed for ${partName}: ${result.error || 'unknown'}`)
          }
        } finally {
          stopHeartbeat()
        }
      })

      console.log(`[ingest] completed ${partName}`)
    }

    docState.docIds = docPartIds
    docState.steps.ingest = {
      status: 'success',
      startedAt: docState.steps.parse?.startedAt || nowIso(),
      finishedAt: nowIso(),
    }
    saveState(state)

    docIds.push(...docPartIds)
  }

  return docIds
}

async function runSmokeQuery(state: E2EState, userId: string, kbId: string, docIds: string[]) {
  if (docIds.length === 0) {
    throw new Error('No docIds available for retrieval smoke test')
  }

  console.log('\n[smoke] retrieval')
  console.log(`  query: ${SMOKE_QUERY}`)
  console.log(`  docIds: ${docIds.join(', ')}`)

  const ragStart = Date.now()
  const result = await withRetry('rag', () =>
    withTimeout(
      ragRetrieve(userId, SMOKE_QUERY, {
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
      }),
      TIMEOUT_RAG_MS,
      'ragRetrieve'
    )
  )
  const ragMs = Date.now() - ragStart
  recordTiming(state, 'rag', ragMs)

  console.log(
    `  retrieved: doc=${result.context.document ? 1 : 0}, parents=${result.context.parents.length}, children=${result.context.children.length}`
  )

  if (!RUN_LLM_ANSWER) return { ragMs }

  const docText = result.context.document?.payload?.content || ''
  const parents = result.context.parents
    .map((p, idx) => `Parent ${idx + 1} (score=${p.score.toFixed(3)}): ${p.payload?.content || ''}`)
    .join('\n\n')
  const children = [...result.context.children]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOPK_CHILD)
    .map((c, idx) => `Child ${idx + 1} (score=${c.score.toFixed(3)}): ${c.payload?.content || ''}`)
    .join('\n\n')

  const messages = [
    {
      role: 'system' as const,
      content: 'You are a precise assistant. Answer only from the provided context. If not found, say "Not found".',
    },
    {
      role: 'user' as const,
      content: `Question: ${SMOKE_QUERY}\nDocument KType Report:\n${docText}\n\nParents:\n${parents}\n\nTop${TOPK_CHILD} Children:\n${children}\n\nAnswer based on context only.`,
    },
  ]

  const llm = createLLMClient('deepseek_v32')
  const llmStart = Date.now()
  const { content } = await withRetry('llm', () =>
    withTimeout(llm.chat(messages, { temperature: 0.2, maxTokens: 400 }), TIMEOUT_LLM_MS, 'llm')
  )
  const llmMs = Date.now() - llmStart
  recordTiming(state, 'llm', llmMs)

  console.log('\n[smoke] LLM answer:')
  console.log(content.trim())
  return { ragMs, llmMs }
}

function summarizeTimings(values?: number[]) {
  if (!values || values.length === 0) return null
  const total = values.reduce((sum, v) => sum + v, 0)
  const avg = total / values.length
  const max = Math.max(...values)
  const min = Math.min(...values)
  return { count: values.length, avgMs: avg, minMs: min, maxMs: max }
}

async function main() {
  const qdrantOk = await healthCheck()
  if (!qdrantOk) {
    throw new Error('Qdrant health check failed')
  }

  const state = loadState()
  saveState(state)

  const user = await ensureUser()
  const kb = await ensureKb(user.id)

  const docIds = await ingestDocs(state, user.id, kb.id)
  const smoke = await runSmokeQuery(state, user.id, kb.id, docIds)

  const report = {
    runId: state.runId,
    startedAt: state.startedAt,
    finishedAt: nowIso(),
    docs: Object.values(state.docs),
    smoke,
    timings: {
      parse: summarizeTimings(state.timings.parse),
      upload: summarizeTimings(state.timings.upload),
      process: summarizeTimings(state.timings.process),
      rag: summarizeTimings(state.timings.rag),
      llm: summarizeTimings(state.timings.llm),
    },
  }

  safeWriteJson(REPORT_FILE, report)
  console.log(`[report] saved to ${REPORT_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
