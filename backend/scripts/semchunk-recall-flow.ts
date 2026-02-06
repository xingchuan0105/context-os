import 'dotenv/config'

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import axios from 'axios'
import embeddingClient from '../lib/embedding'
import { createLLMClient } from '../lib/llm-client'
import {
  getDocumentChunks,
  healthCheck,
  search,
  type SearchResult,
} from '../lib/qdrant'

type RecallContext = {
  documents: SearchResult[]
  parents: SearchResult[]
  children: SearchResult[]
}

type TestCase = { id: string; query: string }

const STATE_PATH = process.env.SEMCHUNK_STATE || 'scripts/.semchunk-rag-state.json'
const TESTSET_PATH = process.env.TESTSET_PATH || '测试集.json'
const OUTPUT_PATH = process.env.OUTPUT_PATH || 'scripts/semchunk-recall-report.json'
const RUN_TESTSET = process.env.RUN_TESTSET === '1'
const SAMPLE_SIZE = parseInt(process.env.SAMPLE_SIZE || '0')
const MAX_QUESTIONS = parseInt(process.env.MAX_QUESTIONS || '0')
const SMOKE_QUERY = process.env.SMOKE_QUERY || 'What is encapsulation?'
const ENABLE_LLM = process.env.ENABLE_LLM !== '0'
const ENABLE_EVAL = process.env.ENABLE_EVAL !== '0'
const SLEEP_MS = parseInt(process.env.SLEEP_MS || '150')
const CASE_TIMEOUT_MS = parseInt(process.env.CASE_TIMEOUT_MS || '300000')
const RETRIEVE_TIMEOUT_MS = parseInt(process.env.RETRIEVE_TIMEOUT_MS || '180000')
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '180000')
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '5')
const RATE_LIMIT_BACKOFF_MS = parseInt(process.env.RATE_LIMIT_BACKOFF_MS || '2000')
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '1')

const SCORE_THRESHOLD = parseFloat(process.env.SCORE_THRESHOLD || '0.3')
const DOC_LIMIT = parseInt(process.env.DOC_LIMIT || '6')
const DOC_TOPK = parseInt(process.env.DOC_TOPK || '3')
const CHILD_LIMIT_FROM_DOCS = parseInt(process.env.CHILD_LIMIT_FROM_DOCS || '8')
const CHILD_LIMIT_GLOBAL = parseInt(process.env.CHILD_LIMIT_GLOBAL || '8')
const CHILD_TOPK = parseInt(process.env.CHILD_TOPK || '8')

const USE_RERANK_DEFAULT = process.env.USE_RERANK !== '0'
const RERANK_MODEL = process.env.RERANK_MODEL || 'qwen3-reranker-4b'
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
const RERANK_URL = new URL('/rerank', LITELLM_BASE_URL).toString()
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-not-needed'
const RERANK_TIMEOUT_MS = parseInt(process.env.RERANK_TIMEOUT_MS || '30000')

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err)
  return /rate\s*limit|429|too\s*many\s*requests|quota|tpm|rpm/i.test(message)
}

function safeParseJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
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

function estimateTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const words = (text.match(/[A-Za-z0-9]+/g) || []).length
  const other = (text.match(/[^\s]/g) || []).length - cjk - words
  return cjk + words + Math.max(0, other)
}

function loadState(): { userId: string; kbId: string } {
  const userId = process.env.USER_ID
  const kbId = process.env.KB_ID
  if (userId && kbId) return { userId, kbId }
  if (!existsSync(STATE_PATH)) {
    throw new Error(`State file not found: ${STATE_PATH}`)
  }
  const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as {
    userId: string
    kbId: string
  }
  if (!state.userId || !state.kbId) {
    throw new Error('State file missing userId/kbId')
  }
  return { userId: state.userId, kbId: state.kbId }
}

function loadTestSet(): TestCase[] {
  const raw = readFileSync(resolve(process.cwd(), TESTSET_PATH), 'utf-8')
  const tests: TestCase[] = []
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\.\s+(.*\S)\s*$/)
    if (m) {
      const num = parseInt(m[1], 10)
      tests.push({ id: `q_${String(num).padStart(3, '0')}`, query: m[2].trim() })
    }
  }
  if (tests.length === 0) {
    throw new Error('Failed to parse test set: no "number. question" lines found')
  }
  return tests
}

async function rerankLayer(
  query: string,
  items: SearchResult[],
  topN: number,
  enabled: boolean,
): Promise<SearchResult[]> {
  if (!enabled || items.length === 0) return items

  try {
    const { data } = await axios.post(
      RERANK_URL,
      {
        model: RERANK_MODEL,
        query,
        documents: items.map((item) => item.payload.content),
        top_n: Math.min(topN, items.length),
      },
      {
        headers: {
          Authorization: `Bearer ${LITELLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: RERANK_TIMEOUT_MS,
      },
    )

    const scoreByIdx = new Map<number, number>()
    for (const entry of data?.data || []) {
      if (typeof entry.index === 'number' && typeof entry.relevance_score === 'number') {
        scoreByIdx.set(entry.index, entry.relevance_score)
      }
    }

    return items
      .map((item, idx) => ({
        ...item,
        score: scoreByIdx.get(idx) ?? item.score ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(topN, items.length))
  } catch (err) {
    console.warn(
      `[rerank] failed, keep original order: ${err instanceof Error ? err.message : String(err)}`
    )
    return items
  }
}

function mergeByKey(items: SearchResult[], keyFn: (item: SearchResult) => string) {
  const map = new Map<string, SearchResult>()
  for (const item of items) {
    map.set(keyFn(item), item)
  }
  return Array.from(map.values())
}

async function retrieveRecallFlow(
  userId: string,
  kbId: string,
  query: string,
  parentCache: Map<string, Map<string, SearchResult>>,
): Promise<RecallContext> {
  const queryVector = await embeddingClient.embeddings
    .create({ model: process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b', input: query })
    .then((res) => res.data[0].embedding)

  const docCandidates = await search(userId, queryVector, {
    limit: DOC_LIMIT,
    scoreThreshold: SCORE_THRESHOLD,
    filter: { kbId, type: 'document' },
  })

  let docPool = docCandidates
  if (docCandidates.length < DOC_LIMIT) {
    const fallback = await search(userId, queryVector, {
      limit: DOC_LIMIT,
      filter: { kbId, type: 'document' },
    })
    docPool = mergeByKey(
      [...docCandidates, ...fallback],
      (item) => `${item.payload.doc_id}:${item.payload.type}:${item.payload.chunk_index}`
    )
      .sort((a, b) => b.score - a.score)
      .slice(0, DOC_LIMIT)
  }

  const docTop = await rerankLayer(query, docPool, DOC_TOPK, USE_RERANK_DEFAULT)
  const docIds = docTop.map((d) => d.payload.doc_id).filter(Boolean)

  const childFromDocs: SearchResult[] = []
  for (const docId of docIds) {
    const primary = await search(userId, queryVector, {
      limit: CHILD_LIMIT_FROM_DOCS,
      scoreThreshold: SCORE_THRESHOLD,
      filter: { kbId, docId, type: 'child' },
    })
    let children = primary
    if (primary.length < CHILD_LIMIT_FROM_DOCS) {
      const fallback = await search(userId, queryVector, {
        limit: CHILD_LIMIT_FROM_DOCS,
        filter: { kbId, docId, type: 'child' },
      })
      children = mergeByKey(
        [...primary, ...fallback],
        (item) => `${item.payload.doc_id}:${item.payload.type}:${item.payload.chunk_index}`
      ).sort((a, b) => b.score - a.score)
    }
    childFromDocs.push(...children)
  }

  const childGlobalPrimary = await search(userId, queryVector, {
    limit: CHILD_LIMIT_GLOBAL,
    scoreThreshold: SCORE_THRESHOLD,
    filter: { kbId, type: 'child' },
  })
  let childGlobal = childGlobalPrimary
  if (childGlobalPrimary.length < CHILD_LIMIT_GLOBAL) {
    const fallback = await search(userId, queryVector, {
      limit: CHILD_LIMIT_GLOBAL,
      filter: { kbId, type: 'child' },
    })
    childGlobal = mergeByKey(
      [...childGlobalPrimary, ...fallback],
      (item) => `${item.payload.doc_id}:${item.payload.type}:${item.payload.chunk_index}`
    ).sort((a, b) => b.score - a.score)
  }

  const mergedChildren = mergeByKey(
    [...childFromDocs, ...childGlobal],
    (item) => `${item.payload.doc_id}:${item.payload.type}:${item.payload.chunk_index}`
  )
    .sort((a, b) => b.score - a.score)
    .slice(0, CHILD_LIMIT_FROM_DOCS + CHILD_LIMIT_GLOBAL)

  const childTop = await rerankLayer(query, mergedChildren, CHILD_TOPK, USE_RERANK_DEFAULT)

  const parentDocIds = new Set<string>()
  for (const child of childTop) {
    if (child.payload.doc_id) parentDocIds.add(child.payload.doc_id)
  }

  const parentByDoc = new Map<string, Map<string, SearchResult>>()
  for (const docId of parentDocIds) {
    if (parentCache.has(docId)) {
      parentByDoc.set(docId, parentCache.get(docId)!)
      continue
    }
    const parents = await getDocumentChunks(userId, docId, { type: 'parent', limit: 5000 })
    const parentMap = new Map<string, SearchResult>()
    for (const parent of parents) {
      if (!parent.payload) continue
      const key = `${docId}:${parent.payload.chunk_index}`
      parentMap.set(key, {
        id: Number(parent.id),
        score: 0,
        payload: parent.payload,
      })
    }
    parentCache.set(docId, parentMap)
    parentByDoc.set(docId, parentMap)
  }

  const parents: SearchResult[] = []
  const parentSeen = new Set<string>()
  for (const child of childTop) {
    const parentIndex =
      typeof (child.payload.metadata as any)?.parent_index === 'number'
        ? (child.payload.metadata as any).parent_index
        : null
    if (parentIndex === null || parentIndex === undefined) continue
    const key = `${child.payload.doc_id}:${parentIndex}`
    const map = parentByDoc.get(child.payload.doc_id)
    const parent = map?.get(key)
    if (parent && !parentSeen.has(key)) {
      parentSeen.add(key)
      parents.push(parent)
    }
  }

  return {
    documents: docTop,
    parents,
    children: childTop,
  }
}

function buildContextText(context: RecallContext): string {
  const docs = context.documents
    .map((doc, idx) => `Doc ${idx + 1} (score=${doc.score.toFixed(3)}): ${doc.payload.content}`)
    .join('\n\n')
  const parents = context.parents
    .map((parent, idx) => `Parent ${idx + 1}: ${parent.payload.content}`)
    .join('\n\n')
  const children = context.children
    .map((child, idx) => `Child ${idx + 1} (score=${child.score.toFixed(3)}): ${child.payload.content}`)
    .join('\n\n')
  return `Documents:\n${docs}\n\nParents:\n${parents}\n\nChildren:\n${children}`
}

async function generateAnswer(query: string, context: RecallContext): Promise<string> {
  if (!ENABLE_LLM) return ''
  const llm = createLLMClient('deepseek_v32')
  const contextText = buildContextText(context)
  const messages = [
    {
      role: 'system' as const,
      content:
        'You are a strict assistant. Answer only from provided context. If missing, say "Not found". Answer in Chinese.',
    },
    {
      role: 'user' as const,
      content: `Question: ${query}\n\n${contextText}`,
    },
  ]
  const { content } = await withTimeout(
    llm.chat(messages, { temperature: 0.2, maxTokens: 900 }),
    LLM_TIMEOUT_MS,
    'llm'
  )
  return content.trim()
}

async function gradeAnswer(query: string, answer: string) {
  if (!ENABLE_EVAL) return null
  const llm = createLLMClient('deepseek_chat')
  const prompt = `你是严格的评分员，请根据以下标准对系统回答进行评分（1-5分，5为最好），只输出JSON：\n` +
    `1) Comprehensiveness：是否覆盖关键点/细节，是否充分利用语料知识\n` +
    `2) Diversity：是否多角度（技术行为/系统行为/长期影响等），是否体现跨层次分析\n` +
    `3) Empowerment：是否帮助读者理解系统逻辑，是否给出可执行指引\n` +
    `4) Overall：综合前三项，考虑逻辑连贯、准确性与表述质量\n` +
    `输出格式：{\n` +
    `  "Comprehensiveness": { "Score": 0, "Reason": "..." },\n` +
    `  "Diversity": { "Score": 0, "Reason": "..." },\n` +
    `  "Empowerment": { "Score": 0, "Reason": "..." },\n` +
    `  "Overall": { "Score": 0, "Reason": "..." }\n` +
    `}\n\n` +
    `待评估问题：${query}\n` +
    `系统回答：${answer.slice(0, 4000)}`

  try {
    const { content } = await withTimeout(
      llm.chat(
        [
          { role: 'system', content: '你是严格的评分员，只能输出JSON。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0 },
      ),
      LLM_TIMEOUT_MS,
      'eval'
    )
    const parsed = safeParseJson(content)
    if (!parsed) throw new Error('invalid json')
    return parsed
  } catch (err) {
    return {
      Comprehensiveness: { Score: 0, Reason: '评分失败' },
      Diversity: { Score: 0, Reason: '评分失败' },
      Empowerment: { Score: 0, Reason: '评分失败' },
      Overall: { Score: 0, Reason: '评分失败' },
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function normalizeTests(tests: TestCase[]): TestCase[] {
  let result = tests
  if (SAMPLE_SIZE > 0 && SAMPLE_SIZE < result.length) {
    const shuffled = [...result].sort(() => Math.random() - 0.5)
    result = shuffled.slice(0, SAMPLE_SIZE)
  }
  if (MAX_QUESTIONS > 0) {
    result = result.slice(0, MAX_QUESTIONS)
  }
  return result
}

async function main() {
  const ok = await healthCheck()
  if (!ok) {
    throw new Error('Qdrant health check failed')
  }

  const { userId, kbId } = loadState()
  const parentCache = new Map<string, Map<string, SearchResult>>()

  if (!RUN_TESTSET) {
    const start = Date.now()
    const context = await withTimeout(
      retrieveRecallFlow(userId, kbId, SMOKE_QUERY, parentCache),
      RETRIEVE_TIMEOUT_MS,
      'retrieve'
    )
    const answer = await generateAnswer(SMOKE_QUERY, context)
    const elapsed = Date.now() - start
    const tokens = estimateTokens(buildContextText(context))
    console.log(
      `[recall] time=${elapsed}ms docs=${context.documents.length} parents=${context.parents.length} children=${context.children.length} tokens=${tokens}`
    )
    if (ENABLE_LLM) {
      console.log('\n[answer]\n' + answer)
    }
    return
  }

  const tests = normalizeTests(loadTestSet())
  const existing = existsSync(OUTPUT_PATH)
    ? (JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8')) as { cases?: Array<any> }).cases || []
    : []
  const results: Array<any> = [...existing]
  const doneIds = new Set(results.map((r) => r.id))

  let concurrency = Math.max(1, MAX_CONCURRENCY)
  let index = 0

  const queue = tests.filter((t) => !doneIds.has(t.id))
  const total = queue.length

  const processCase = async (test: TestCase) => {
    const start = Date.now()
    const context = await withTimeout(
      retrieveRecallFlow(userId, kbId, test.query, parentCache),
      RETRIEVE_TIMEOUT_MS,
      'retrieve'
    )
    const answer = await generateAnswer(test.query, context)
    const score = await gradeAnswer(test.query, answer)
    const elapsed = Date.now() - start
    const tokens = estimateTokens(buildContextText(context))
    return {
      id: test.id,
      query: test.query,
      docs: context.documents.length,
      parents: context.parents.length,
      children: context.children.length,
      tokens,
      elapsed_ms: elapsed,
      doc_ids: context.documents.map((d) => d.payload.doc_id),
      answer: ENABLE_LLM ? answer : undefined,
      score,
    }
  }

  const runCaseWithRetry = async (test: TestCase) => {
    let attempt = 0
    while (attempt <= MAX_RETRIES) {
      try {
        return await withTimeout(processCase(test), CASE_TIMEOUT_MS, `case ${test.id}`)
      } catch (err) {
        const rateLimited = isRateLimitError(err)
        if (rateLimited) {
          concurrency = Math.max(1, concurrency - 1)
          console.warn(`[recall] rate limit detected, concurrency -> ${concurrency}`)
        }
        if (rateLimited && attempt < MAX_RETRIES) {
          await sleep(RATE_LIMIT_BACKOFF_MS)
          attempt += 1
          continue
        }
        throw err
      }
    }
    throw new Error('unreachable')
  }

  await new Promise<void>((resolve) => {
    let active = 0

    const launch = () => {
      while (active < concurrency && index < total) {
        const test = queue[index++]
        active += 1
        runCaseWithRetry(test)
          .then((result) => {
            results.push(result)
            doneIds.add(test.id)
            console.log(`[recall] ${test.id} done`)
          })
          .catch((err) => {
            results.push({
              id: test.id,
              query: test.query,
              error: err instanceof Error ? err.message : String(err),
            })
            doneIds.add(test.id)
            console.warn(`[recall] ${test.id} failed`)
          })
          .finally(async () => {
            active -= 1
            writeFileSync(
              OUTPUT_PATH,
              JSON.stringify({ total: results.length, cases: results }, null, 2),
              'utf-8'
            )
            if (SLEEP_MS > 0) {
              await sleep(SLEEP_MS)
            }
            if (index >= total && active === 0) {
              resolve()
            } else {
              launch()
            }
          })
      }
    }

    launch()
  })

  writeFileSync(OUTPUT_PATH, JSON.stringify({ total: results.length, cases: results }, null, 2), 'utf-8')
  console.log(`[recall] report saved -> ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
