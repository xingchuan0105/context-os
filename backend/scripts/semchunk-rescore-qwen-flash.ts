import 'dotenv/config'

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { createLLMClient } from '../lib/llm-client'

type ScoreItem = { Score: number; Reason: string }
type ScoreBlock = {
  Comprehensiveness: ScoreItem
  Diversity: ScoreItem
  Empowerment: ScoreItem
  Overall: ScoreItem
  error?: string
}

type ScoreMeta = {
  model: string
  status: 'scored' | 'skipped_no_answer' | 'error'
  rated_at: string
  attempts: number
  prompt_version: string
  error?: string
}

type ReportCase = {
  id: string
  query: string
  answer?: string
  error?: string
  score?: ScoreBlock
  score_prev?: ScoreBlock
  score_meta?: ScoreMeta
  score_prev_meta?: ScoreMeta
  [key: string]: any
}

type Report = {
  total: number
  cases: ReportCase[]
}

const INPUT_PATH = process.env.INPUT_PATH || 'scripts/semchunk-recall-report.json'
const OUTPUT_PATH = process.env.OUTPUT_PATH || 'scripts/semchunk-recall-report.qwen-flash.json'
const EVAL_MODEL = process.env.EVAL_MODEL || 'qwen_flash'
const SCORE_MODEL_TAG = process.env.SCORE_MODEL_TAG || 'qwen-flash'
const PROMPT_VERSION = 'v1'
const FORCE_RESCORE = process.env.FORCE_RESCORE === '1'
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '5', 10)
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '2', 10)
const RATE_LIMIT_BACKOFF_MS = parseInt(process.env.RATE_LIMIT_BACKOFF_MS || '2000', 10)
const ERROR_BACKOFF_MS = parseInt(process.env.ERROR_BACKOFF_MS || '800', 10)
const CASE_TIMEOUT_MS = parseInt(process.env.CASE_TIMEOUT_MS || '180000', 10)
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '120000', 10)
const MAX_ANSWER_CHARS = parseInt(process.env.MAX_ANSWER_CHARS || '4000', 10)

const EVAL_SYSTEM_PROMPT = 'You are a strict grader. Output JSON only.'
const EVAL_PROMPT = `You are a strict grader. Score the system answer on a 1-5 scale (5 is best). Output JSON only.
1) Comprehensiveness: coverage of key points/details; whether it uses the provided knowledge well.
2) Diversity: multi-angle analysis (technical/behavior/system/long-term impact), cross-layer reasoning.
3) Empowerment: helps readers understand system logic; provides actionable guidance.
4) Overall: combine the above, considering coherence, accuracy, and clarity.
Output format:
{
  "Comprehensiveness": { "Score": 0, "Reason": "..." },
  "Diversity": { "Score": 0, "Reason": "..." },
  "Empowerment": { "Score": 0, "Reason": "..." },
  "Overall": { "Score": 0, "Reason": "..." }
}`

const EMPTY_SCORE: ScoreBlock = {
  Comprehensiveness: { Score: 0, Reason: 'grading failed' },
  Diversity: { Score: 0, Reason: 'grading failed' },
  Empowerment: { Score: 0, Reason: 'grading failed' },
  Overall: { Score: 0, Reason: 'grading failed' },
}

function emptyScoreWith(reason: string): ScoreBlock {
  return {
    Comprehensiveness: { Score: 0, Reason: reason },
    Diversity: { Score: 0, Reason: reason },
    Empowerment: { Score: 0, Reason: reason },
    Overall: { Score: 0, Reason: reason },
  }
}

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
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
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

function loadReport(path: string): Report {
  const raw = readFileSync(resolve(process.cwd(), path), 'utf-8')
  const parsed = JSON.parse(raw) as Report
  if (!Array.isArray(parsed.cases)) {
    throw new Error(`Invalid report format: ${path}`)
  }
  return parsed
}

async function gradeWithQwenFlash(query: string, answer: string): Promise<ScoreBlock> {
  const llm = createLLMClient(EVAL_MODEL)
  const prompt = `${EVAL_PROMPT}\n\nQuestion:\n${query}\n\nAnswer:\n${answer.slice(0, MAX_ANSWER_CHARS)}`
  const { content } = await withTimeout(
    llm.chat(
      [
        { role: 'system', content: EVAL_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      { temperature: 0, maxTokens: 600 },
    ),
    LLM_TIMEOUT_MS,
    'eval'
  )
  const parsed = safeParseJson(content)
  if (!parsed) throw new Error('invalid json response')
  return parsed as ScoreBlock
}

function shouldSkip(caseItem: ReportCase): boolean {
  if (FORCE_RESCORE) return false
  const meta = caseItem.score_meta
  return (
    meta?.model === SCORE_MODEL_TAG &&
    (meta.status === 'scored' || meta.status === 'skipped_no_answer')
  )
}

async function main() {
  const input = loadReport(INPUT_PATH)
  const output = existsSync(resolve(process.cwd(), OUTPUT_PATH))
    ? loadReport(OUTPUT_PATH)
    : { total: input.total, cases: [] }

  const inputOrder = input.cases.map((c) => c.id)
  const caseById = new Map<string, ReportCase>()

  for (const c of output.cases) {
    caseById.set(c.id, { ...c })
  }
  for (const c of input.cases) {
    if (!caseById.has(c.id)) {
      caseById.set(c.id, { ...c })
    }
  }

  const pending = inputOrder
    .map((id) => caseById.get(id))
    .filter((c): c is ReportCase => Boolean(c))
    .filter((c) => !shouldSkip(c))

  console.log(`[rescore] total=${input.cases.length} pending=${pending.length}`)

  let concurrency = Math.max(1, MAX_CONCURRENCY)
  let index = 0

  const saveOutput = () => {
    const ordered = inputOrder
      .map((id) => caseById.get(id))
      .filter((c): c is ReportCase => Boolean(c))
    writeFileSync(
      resolve(process.cwd(), OUTPUT_PATH),
      JSON.stringify({ total: ordered.length, cases: ordered }, null, 2),
      'utf-8'
    )
  }

  const processCase = async (caseItem: ReportCase) => {
    if (!caseItem.answer || !caseItem.answer.trim()) {
      return {
        status: 'skipped_no_answer' as const,
        attempts: 0,
        error: caseItem.error || 'missing answer',
      }
    }

    let attempt = 0
    while (attempt <= MAX_RETRIES) {
      try {
        const score = await withTimeout(
          gradeWithQwenFlash(caseItem.query, caseItem.answer),
          CASE_TIMEOUT_MS,
          `case ${caseItem.id}`
        )
        return {
          status: 'scored' as const,
          attempts: attempt + 1,
          score,
        }
      } catch (err) {
        const rateLimited = isRateLimitError(err)
        if (rateLimited) {
          concurrency = Math.max(1, concurrency - 1)
          console.warn(`[rescore] rate limit detected, concurrency -> ${concurrency}`)
        }
        if (attempt < MAX_RETRIES) {
          await sleep(rateLimited ? RATE_LIMIT_BACKOFF_MS : ERROR_BACKOFF_MS)
          attempt += 1
          continue
        }
        return {
          status: 'error' as const,
          attempts: attempt + 1,
          error: err instanceof Error ? err.message : String(err),
          score: { ...EMPTY_SCORE, error: err instanceof Error ? err.message : String(err) },
        }
      }
    }
    return {
      status: 'error' as const,
      attempts: MAX_RETRIES + 1,
      error: 'unreachable',
      score: { ...EMPTY_SCORE, error: 'unreachable' },
    }
  }

  await new Promise<void>((resolve) => {
    let active = 0

    const launch = () => {
      while (active < concurrency && index < pending.length) {
        const caseItem = pending[index++]
        active += 1
        processCase(caseItem)
          .then((result) => {
            const current = caseById.get(caseItem.id) || caseItem
            const now = new Date().toISOString()
            if (
              current.score &&
              current.score_meta?.model !== SCORE_MODEL_TAG &&
              !current.score_prev
            ) {
              current.score_prev = current.score
              current.score_prev_meta = current.score_meta
            }

            if (result.status === 'scored' && result.score) {
              current.score = result.score
            } else if (result.status === 'skipped_no_answer') {
              current.score = emptyScoreWith(result.error || 'missing answer')
            } else if (result.status === 'error') {
              current.score = result.score || emptyScoreWith(result.error || 'grading failed')
            }
            current.score_meta = {
              model: SCORE_MODEL_TAG,
              status: result.status,
              rated_at: now,
              attempts: result.attempts,
              prompt_version: PROMPT_VERSION,
              ...(result.error ? { error: result.error } : {}),
            }
            caseById.set(caseItem.id, current)
            console.log(`[rescore] ${caseItem.id} ${result.status}`)
          })
          .catch((err) => {
            const current = caseById.get(caseItem.id) || caseItem
            if (
              current.score &&
              current.score_meta?.model !== SCORE_MODEL_TAG &&
              !current.score_prev
            ) {
              current.score_prev = current.score
              current.score_prev_meta = current.score_meta
            }
            current.score = emptyScoreWith('grading failed')
            current.score_meta = {
              model: SCORE_MODEL_TAG,
              status: 'error',
              rated_at: new Date().toISOString(),
              attempts: 1,
              prompt_version: PROMPT_VERSION,
              error: err instanceof Error ? err.message : String(err),
            }
            caseById.set(caseItem.id, current)
            console.warn(`[rescore] ${caseItem.id} failed`)
          })
          .finally(() => {
            active -= 1
            saveOutput()
            if (index >= pending.length && active === 0) {
              resolve()
              return
            }
            launch()
          })
      }
    }

    launch()
  })

  console.log(`[rescore] done -> ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
