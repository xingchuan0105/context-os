import 'dotenv/config'

if (!process.env.EMBEDDING_MODEL) {
  process.env.EMBEDDING_MODEL = 'qwen3-embedding-4b'
}

import { spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { initializeDatabase, db } from '../lib/db/schema'
import {
  createKnowledgeBase,
  createDocument,
  updateDocumentKType,
  updateDocumentStatus,
} from '../lib/db/queries'
import {
  deleteUserCollection,
  ensureUserCollection,
  getDocumentChunks,
  healthCheck,
  search,
  upsertPoints,
  type SearchResult,
  type VectorPoint,
} from '../lib/qdrant'
import { parseFile, formatAsMarkdown, toMarkdownFileName } from '../lib/parsers'
import { uploadMarkdownToLocal } from '../lib/storage/local'
import { processKTypeWorkflowEfficient, type KTypeProcessResult } from '../lib/processors/k-type-efficient-vercel'
import embeddingClient from '../lib/embedding'
import { ragRetrieve } from '../lib/rag/retrieval'
import { createLLMClient } from '../lib/llm-client'

const TEST_USER_EMAIL = 'semchunk-rag@example.com'
const TEST_KB_TITLE = 'Semchunk RAG KB'
const DOC_FILES =
  process.env.DOC_FILES?.split(',').map((s) => s.trim()).filter(Boolean) ||
  ['test.pdf', 'test2.pdf', 'test3.pdf']

const KTYPE_MAX_TOKENS = 500000
const DOC_CHUNK_SIZE = 2400
const DOC_CHUNK_OVERLAP = 300
const PARENT_CHUNK_SIZE = 1600
const PARENT_CHUNK_OVERLAP = 240
const CHILD_CHUNK_SIZE = 420
const CHILD_CHUNK_OVERLAP = 100
const EMBEDDING_BATCH_SIZE = 10
const SCORE_THRESHOLD = 0.3

const DOC_LIMIT = 6
const DOC_TOPK = 3
const CHILD_LIMIT_FROM_DOCS = 8
const CHILD_LIMIT_GLOBAL = 8
const CHILD_TOPK = 8

const RUN_LLM_ANSWER = process.env.SMOKE_RUN_LLM !== '0'
const SMOKE_QUERY = process.env.SMOKE_QUERY || 'What is encapsulation?'
const STAGE = (process.env.SEMCHUNK_STAGE || 'both').toLowerCase()
const STATE_PATH = process.env.SEMCHUNK_STATE || 'scripts/.semchunk-rag-state.json'
const SEMCHUNK_TIMEOUT_MS = parseInt(process.env.SEMCHUNK_TIMEOUT_MS || '300000')

const USE_RERANK_DEFAULT = process.env.USE_RERANK !== '0'
const RERANK_MODEL = process.env.RERANK_MODEL || 'qwen3-reranker-4b'
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
const RERANK_URL = new URL('/rerank', LITELLM_BASE_URL).toString()
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-not-needed'
const RERANK_TIMEOUT_MS = parseInt(process.env.RERANK_TIMEOUT_MS || '30000')

const SEMCHUNK_SCRIPT = `
import json
import re
import sys
import semchunk

def count_tokens(text):
    cjk = len(re.findall(r'[\\u4e00-\\u9fff]', text))
    words = len(re.findall(r'[A-Za-z0-9]+', text))
    other = len(re.findall(r'[^\\s]', text)) - cjk - words
    if other < 0:
        other = 0
    return cjk + words + other

payload = json.load(sys.stdin)
chunk_size = int(payload.get('chunk_size') or 0)
overlap = payload.get('overlap')
if overlap is not None:
    overlap = float(overlap)

chunker = semchunk.chunkerify(count_tokens, chunk_size)

texts = payload.get('texts')
if texts is not None:
    if overlap is None or overlap == 0:
        chunks = chunker(texts)
    else:
        chunks = chunker(texts, overlap=overlap)
    json.dump({'chunks': chunks}, sys.stdout, ensure_ascii=False)
else:
    text = payload.get('text', '')
    if overlap is None or overlap == 0:
        chunks = chunker(text)
    else:
        chunks = chunker(text, overlap=overlap)
    json.dump({'chunks': chunks}, sys.stdout, ensure_ascii=False)
`

function estimateTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const words = (text.match(/[A-Za-z0-9]+/g) || []).length
  const other = (text.match(/[^\s]/g) || []).length - cjk - words
  return cjk + words + Math.max(0, other)
}

async function runSemchunk(
  input: { text: string } | { texts: string[] },
  chunkSize: number,
  overlap?: number,
): Promise<string[] | string[][]> {
  const payload = JSON.stringify({
    ...input,
    chunk_size: chunkSize,
    overlap: overlap ?? null,
  })

  return new Promise((resolve, reject) => {
    const proc = spawn('python', ['-c', SEMCHUNK_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`semchunk timeout after ${SEMCHUNK_TIMEOUT_MS}ms`))
    }, SEMCHUNK_TIMEOUT_MS)

    proc.stdout.on('data', (data) => {
      stdout += data.toString('utf-8')
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString('utf-8')
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(stderr || `semchunk failed with code ${code}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout)
        resolve(parsed.chunks || [])
      } catch (err) {
        reject(new Error(`semchunk parse error: ${err instanceof Error ? err.message : String(err)}`))
      }
    })

    proc.stdin.write(payload)
    proc.stdin.end()
  })
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

async function ensureUser(reset = true) {
  initializeDatabase()
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(TEST_USER_EMAIL) as any
  if (existing && reset) {
    db.prepare('DELETE FROM documents WHERE user_id = ?').run(existing.id)
    db.prepare('DELETE FROM knowledge_bases WHERE user_id = ?').run(existing.id)
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(existing.id)
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.id)
    try {
      await deleteUserCollection(existing.id)
    } catch (err) {
      console.warn(
        `[reset] failed to delete qdrant collection: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
  if (existing && !reset) {
    return { id: existing.id, email: TEST_USER_EMAIL }
  }

  const id = uuidv4()
  db.prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(
    id,
    TEST_USER_EMAIL,
    'test-hash',
    'Semchunk RAG User'
  )
  return { id, email: TEST_USER_EMAIL }
}

async function ensureKb(userId: string) {
  let kb = db
    .prepare('SELECT * FROM knowledge_bases WHERE user_id = ? AND title = ?')
    .get(userId, TEST_KB_TITLE) as any
  if (!kb) {
    kb = await createKnowledgeBase(userId, TEST_KB_TITLE, undefined, 'Semchunk KB')
  }
  return kb
}

function buildKTypeDocText(report: KTypeProcessResult['finalReport']): string {
  const parts: string[] = []
  if (report.title) parts.push(`# ${report.title}`)
  if (report.executiveSummary) parts.push(`## Executive Summary\n${report.executiveSummary}`)
  if (report.distilledContent) parts.push(`## Distilled Summary\n${report.distilledContent}`)

  const dominantTypes = report.classification?.dominantType?.join(', ') || ''
  const scores = report.classification?.scores
  const scoreText = scores
    ? `procedural=${scores.procedural}, conceptual=${scores.conceptual}, reasoning=${scores.reasoning}, systemic=${scores.systemic}, narrative=${scores.narrative}`
    : ''
  if (dominantTypes || scoreText) {
    parts.push(`## Classification\nDominant: ${dominantTypes || 'n/a'}\nScores: ${scoreText || 'n/a'}`)
  }

  if (report.scanTrace) {
    parts.push(
      `## Scan Trace\nDIKW: ${report.scanTrace.dikwLevel || 'n/a'}\nLogic: ${
        report.scanTrace.logicPattern || 'n/a'
      }\nTacit/Explicit: ${report.scanTrace.tacitExplicitRatio || 'n/a'}`
    )
  }

  if (report.knowledgeModules?.length) {
    const moduleText = report.knowledgeModules
      .map((m, idx) => {
        const header = `- ${idx + 1}. ${m.type} (${m.score}/10): ${m.coreValue || ''}`
        const content = m.content ? `  Notes: ${m.content}` : ''
        const evidence = m.evidence && m.evidence.length > 0 ? `  Evidence: ${m.evidence.join(' | ')}` : ''
        const source = m.sourcePreview ? `  Source: ${m.sourcePreview}` : ''
        return [header, content, evidence, source].filter(Boolean).join('\n')
      })
      .join('\n')
    parts.push(`## Knowledge Modules\n${moduleText}`)
  }

  return parts.filter(Boolean).join('\n\n')
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE)
    const response = await embeddingClient.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b',
      input: batch,
    })
    embeddings.push(...response.data.map((d) => d.embedding))
  }
  return embeddings
}

async function ingestWithSemchunk(userId: string, kbId: string) {
  await ensureUserCollection(userId)
  const docIds: string[] = []
  const failures: string[] = []

  for (const file of DOC_FILES) {
    try {
      const abs = resolve(process.cwd(), file)
      const buf = readFileSync(abs)
      console.log(`\n[ingest] file: ${file}`)

      const parsed = await parseFile(buf, 'application/pdf', file)
      const markdown = formatAsMarkdown(parsed.content, file, parsed.metadata)
      const uploadResult = await uploadMarkdownToLocal(userId, kbId, toMarkdownFileName(file), markdown)

      const doc = await createDocument(
        kbId,
        userId,
        toMarkdownFileName(file),
        uploadResult.path,
        uploadResult.base64Content || null,
        'text/markdown',
        Buffer.byteLength(markdown, 'utf-8')
      )
      docIds.push(doc.id)
      await updateDocumentStatus(doc.id, 'processing')

      const ktypeInputs = (await runSemchunk({ text: parsed.content }, KTYPE_MAX_TOKENS)) as string[]
      console.log(`[ingest] ktype parts: ${ktypeInputs.length} (tokens=${estimateTokens(parsed.content)})`)

      const ktypeResults: KTypeProcessResult[] = []
      for (const part of ktypeInputs) {
        const result = await processKTypeWorkflowEfficient(part)
        ktypeResults.push(result)
      }

      const ktypeDocChunks: Array<{ content: string; report: KTypeProcessResult['finalReport'] }> = []
      for (const result of ktypeResults) {
        const ktypeText = buildKTypeDocText(result.finalReport)
        const chunks = (await runSemchunk({ text: ktypeText }, DOC_CHUNK_SIZE, DOC_CHUNK_OVERLAP)) as string[]
        for (const chunk of chunks) {
          ktypeDocChunks.push({ content: chunk, report: result.finalReport })
        }
      }

      const parentTexts = (await runSemchunk(
        { text: parsed.content },
        PARENT_CHUNK_SIZE,
        PARENT_CHUNK_OVERLAP
      )) as string[]

      const childLists = (await runSemchunk(
        { texts: parentTexts },
        CHILD_CHUNK_SIZE,
        CHILD_CHUNK_OVERLAP
      )) as string[][]

      const parentChunks = parentTexts.map((content, index) => ({ index, content }))
      const childChunks: Array<{ index: number; parentIndex: number; content: string }> = []
      let childIndex = 0
      for (let i = 0; i < childLists.length; i++) {
        for (const child of childLists[i] || []) {
          childChunks.push({ index: childIndex++, parentIndex: i, content: child })
        }
      }

      const textsToEmbed: string[] = []
      for (const docChunk of ktypeDocChunks) textsToEmbed.push(docChunk.content)
      for (const parentChunk of parentChunks) textsToEmbed.push(parentChunk.content)
      for (const childChunk of childChunks) textsToEmbed.push(childChunk.content)

      const embeddings = await embedTexts(textsToEmbed)
      let embedIndex = 0

      const points: VectorPoint[] = []
      for (let i = 0; i < ktypeDocChunks.length; i++) {
        const docChunk = ktypeDocChunks[i]
        points.push({
          id: uuidv4(),
          vector: embeddings[embedIndex++],
          payload: {
            doc_id: doc.id,
            kb_id: kbId,
            user_id: userId,
            type: 'document',
            content: docChunk.content,
            chunk_index: i,
            metadata: {
              file_name: file,
              ktype: {
                dominant_type: docChunk.report.classification.dominantType[0] || 'unknown',
                dominant_types: docChunk.report.classification.dominantType,
                type_scores: docChunk.report.classification.scores,
                knowledge_modules: docChunk.report.knowledgeModules.map((m) => m.type),
                dikw_level: docChunk.report.scanTrace.dikwLevel,
                logic_pattern: docChunk.report.scanTrace.logicPattern,
              },
            },
          },
        })
      }

      for (const parentChunk of parentChunks) {
        points.push({
          id: uuidv4(),
          vector: embeddings[embedIndex++],
          payload: {
            doc_id: doc.id,
            kb_id: kbId,
            user_id: userId,
            type: 'parent',
            content: parentChunk.content,
            chunk_index: parentChunk.index,
            metadata: {
              file_name: file,
            },
          },
        })
      }

      for (const childChunk of childChunks) {
        points.push({
          id: uuidv4(),
          vector: embeddings[embedIndex++],
          payload: {
            doc_id: doc.id,
            kb_id: kbId,
            user_id: userId,
            type: 'child',
            content: childChunk.content,
            chunk_index: childChunk.index,
            parent_id: `parent_${doc.id}_${childChunk.parentIndex}`,
            metadata: {
              file_name: file,
              parent_index: childChunk.parentIndex,
            },
          },
        })
      }

      await upsertPoints(userId, points)

      const combinedKTypeText = ktypeResults.map((r) => buildKTypeDocText(r.finalReport)).join('\n\n---\n\n')
      const deepSummary = ktypeResults
        .map((r) => r.finalReport.distilledContent || r.finalReport.executiveSummary || '')
        .filter(Boolean)
        .join('\n\n')
      await updateDocumentKType(
        doc.id,
        combinedKTypeText,
        JSON.stringify(ktypeResults.map((r) => r.finalReport)),
        deepSummary,
        childChunks.length
      )

      console.log(
        `[ingest] doc=${doc.id} ktype_chunks=${ktypeDocChunks.length} parents=${parentChunks.length} children=${childChunks.length}`
      )
    } catch (err) {
      failures.push(`${file}: ${err instanceof Error ? err.message : String(err)}`)
      console.warn(`[ingest] failed: ${file}`)
    }
  }

  if (failures.length > 0) {
    console.warn('[ingest] failures:', failures)
  }
  return docIds
}

async function retrieveSemchunkFlow(userId: string, kbId: string, query: string) {
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
    const merged = new Map<string, SearchResult>()
    for (const item of [...docCandidates, ...fallback]) {
      const key = `${item.payload.doc_id}:${item.payload.type}:${item.payload.chunk_index}`
      merged.set(key, item)
    }
    docPool = Array.from(merged.values()).sort((a, b) => b.score - a.score).slice(0, DOC_LIMIT)
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
      const merged = new Map<string, SearchResult>()
      for (const item of [...primary, ...fallback]) {
        const key = `${item.payload.doc_id}:${item.payload.type}:${item.payload.chunk_index}`
        merged.set(key, item)
      }
      children = Array.from(merged.values()).sort((a, b) => b.score - a.score)
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
    const merged = new Map<string, SearchResult>()
    for (const item of [...childGlobalPrimary, ...fallback]) {
      const key = `${item.payload.doc_id}:${item.payload.type}:${item.payload.chunk_index}`
      merged.set(key, item)
    }
    childGlobal = Array.from(merged.values()).sort((a, b) => b.score - a.score)
  }

  const mergedChildMap = new Map<string, SearchResult>()
  for (const child of [...childFromDocs, ...childGlobal]) {
    const key = `${child.payload.doc_id}:${child.payload.type}:${child.payload.chunk_index}`
    mergedChildMap.set(key, child)
  }

  const mergedChildren = Array.from(mergedChildMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, CHILD_LIMIT_FROM_DOCS + CHILD_LIMIT_GLOBAL)
  const childTop = await rerankLayer(query, mergedChildren, CHILD_TOPK, USE_RERANK_DEFAULT)

  const parentMap = new Map<string, SearchResult>()
  const parentDocIds = new Set<string>()
  for (const child of childTop) {
    if (child.payload.doc_id) parentDocIds.add(child.payload.doc_id)
  }

  for (const docId of parentDocIds) {
    const parents = await getDocumentChunks(userId, docId, { type: 'parent', limit: 2000 })
    for (const parent of parents) {
      if (!parent.payload) continue
      const key = `${docId}:${parent.payload.chunk_index}`
      parentMap.set(key, {
        id: Number(parent.id),
        score: 0,
        payload: parent.payload,
      })
    }
  }

  const parentByChild: SearchResult[] = []
  for (const child of childTop) {
    const parentIndex =
      typeof child.payload.metadata?.parent_index === 'number'
        ? child.payload.metadata.parent_index
        : null
    if (parentIndex === null || parentIndex === undefined) continue
    const key = `${child.payload.doc_id}:${parentIndex}`
    const parent = parentMap.get(key)
    if (parent) parentByChild.push(parent)
  }

  const uniqueParents = new Map<string, SearchResult>()
  for (const parent of parentByChild) {
    const key = `${parent.payload.doc_id}:${parent.payload.type}:${parent.payload.chunk_index}`
    uniqueParents.set(key, parent)
  }

  return {
    documents: docTop,
    children: childTop,
    parents: Array.from(uniqueParents.values()),
  }
}

function buildContextText(context: { documents: SearchResult[]; parents: SearchResult[]; children: SearchResult[] }) {
  const docText = context.documents
    .map((doc, idx) => `Doc ${idx + 1} (score=${doc.score.toFixed(3)}): ${doc.payload.content}`)
    .join('\n\n')
  const parentText = context.parents
    .map((parent, idx) => `Parent ${idx + 1}: ${parent.payload.content}`)
    .join('\n\n')
  const childText = context.children
    .map((child, idx) => `Child ${idx + 1} (score=${child.score.toFixed(3)}): ${child.payload.content}`)
    .join('\n\n')

  return `Documents:\n${docText}\n\nParents:\n${parentText}\n\nChildren:\n${childText}`
}

async function compareWithBaseline(userId: string, kbId: string, query: string) {
  console.log('\n[compare] baseline vs semchunk flow')

  const startBaseline = Date.now()
  const baseline = await ragRetrieve(userId, query, {
    kbId,
    documentLimit: 1,
    parentLimit: 3,
    childLimit: 8,
    scoreThreshold: SCORE_THRESHOLD,
    rerank: true,
    enableDocRouting: false,
  })
  const baselineMs = Date.now() - startBaseline
  const baselineContextText = buildContextText({
    documents: baseline.context.document ? [baseline.context.document] : [],
    parents: baseline.context.parents,
    children: baseline.context.children,
  })
  const baselineTokens = estimateTokens(baselineContextText)

  const startNew = Date.now()
  const semchunkContext = await retrieveSemchunkFlow(userId, kbId, query)
  const semchunkMs = Date.now() - startNew
  const semchunkContextText = buildContextText(semchunkContext)
  const semchunkTokens = estimateTokens(semchunkContextText)

  console.log(
    `[baseline] time=${baselineMs}ms docs=${baseline.context.document ? 1 : 0} parents=${baseline.context.parents.length} children=${baseline.context.children.length} tokens=${baselineTokens}`
  )
  console.log(
    `[semchunk] time=${semchunkMs}ms docs=${semchunkContext.documents.length} parents=${semchunkContext.parents.length} children=${semchunkContext.children.length} tokens=${semchunkTokens}`
  )

  if (!RUN_LLM_ANSWER) return

  const llm = createLLMClient('deepseek_v32')
  const messages = [
    {
      role: 'system' as const,
      content:
        'You answer strictly from provided context. If missing, say "Not found". Keep the answer concise.',
    },
    {
      role: 'user' as const,
      content: `Question: ${query}\n\n${semchunkContextText}`,
    },
  ]
  const { content } = await llm.chat(messages, { temperature: 0.2, maxTokens: 400 })
  console.log('\n[semchunk answer]\n' + content.trim())
}

function writeState(state: { userId: string; kbId: string; docIds: string[] }) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function readState(): { userId: string; kbId: string; docIds: string[] } {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`State file not found: ${STATE_PATH}`)
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
}

async function main() {
  const qdrantOk = await healthCheck()
  if (!qdrantOk) {
    throw new Error('Qdrant health check failed')
  }

  if (STAGE === 'ingest' || STAGE === 'both') {
    const user = await ensureUser(true)
    const kb = await ensureKb(user.id)
    const docIds = await ingestWithSemchunk(user.id, kb.id)
    writeState({ userId: user.id, kbId: kb.id, docIds })
    console.log(`[semchunk] ingest done. state saved -> ${STATE_PATH}`)
  }

  if (STAGE === 'recall' || STAGE === 'both') {
    const state = readState()
    await compareWithBaseline(state.userId, state.kbId, SMOKE_QUERY)
    console.log('[semchunk] recall done')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
