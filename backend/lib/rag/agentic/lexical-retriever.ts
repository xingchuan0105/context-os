import {
  filterDocumentIdsByNotebook,
  getDocumentById,
  getDocumentsByNotebookId,
  getDocumentsByUserId,
  type Document,
} from '@/lib/db/queries'
import { runSemchunk } from '@/lib/semchunk'

import type { AgenticEvidenceCard, AgenticRetrievalInput } from './types'

const MAX_DOCS_PER_QUERY = 48
const DEFAULT_EVIDENCE_LIMIT = 12
const MAX_SCAN_CONTENT_CHARS = 250000
const MAX_CARD_CONTENT_CHARS = 2200
const RETRIEVER_SEMCHUNK_CHUNK_TOKENS = Math.max(
  256,
  Number.parseInt(process.env.AGENTIC_RETRIEVER_SEMCHUNK_CHUNK_TOKENS || '1200', 10) || 1200
)

type PersistedSummaryPayload = {
  schema?: string
  summary_batches?: Array<{
    index?: number
    summary?: string
    sourceTokens?: number
    summaryTokens?: number
  }>
  semantic_chunks?: Array<{
    chunk_id?: string
    content?: string
    token_count?: number
  }>
}

type PersistedSemanticChunk = {
  chunkId: string
  content: string
}

type RelationHint = {
  tokens: Set<string>
  hasStrongRelation: boolean
}

function tokenize(text: string): string[] {
  if (!text) return []
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[\p{L}\p{N}_]+/gu)
        ?.filter((token) => token.length >= 2) || []
    )
  )
}

function normalizeSemanticChunkId(raw: string, fallbackIndex: number): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return `c${String(fallbackIndex + 1).padStart(4, '0')}`
  const found = trimmed.toLowerCase().match(/c(\d{1,6})/)
  if (!found) return `c${String(fallbackIndex + 1).padStart(4, '0')}`
  return `c${found[1].padStart(4, '0')}`
}

function parsePersistedSemanticChunks(doc: Document): PersistedSemanticChunk[] {
  const raw = doc.summary_segments_json
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as PersistedSummaryPayload
    const chunks = Array.isArray(parsed?.semantic_chunks) ? parsed.semantic_chunks : []
    return chunks
      .map((item, index) => {
        const content = String(item?.content || '').trim()
        if (!content) return null
        const chunkId = normalizeSemanticChunkId(String(item?.chunk_id || ''), index)
        return {
          chunkId,
          content:
            content.length > MAX_CARD_CONTENT_CHARS
              ? `${content.slice(0, MAX_CARD_CONTENT_CHARS)}...`
              : content,
        }
      })
      .filter((item): item is PersistedSemanticChunk => Boolean(item))
  } catch (error) {
    console.warn(
      `[AgenticRetriever] failed to parse summary_segments_json for doc=${doc.id}:`,
      error
    )
    return []
  }
}

function parseEvidenceChunkIds(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.toLowerCase() !== 'none')
    .map((item, index) => normalizeSemanticChunkId(item, index))
}

function extractRelationHints(summary: string): Map<string, RelationHint> {
  const hints = new Map<string, RelationHint>()
  if (!summary) return hints

  const lines = summary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const evidenceMatch = line.match(/\[evidence:\s*([^\]]+)\]/i)
    if (!evidenceMatch) continue
    const chunkIds = parseEvidenceChunkIds(evidenceMatch[1] || '')
    if (chunkIds.length === 0) continue

    const relationText = line.replace(/\[evidence:\s*[^\]]+\]/gi, ' ').trim()
    const relationTokens = tokenize(relationText)
    const hasStrongRelation = relationText.includes('=={') || relationText.includes('>>>')

    for (const chunkId of chunkIds) {
      const existing = hints.get(chunkId) || { tokens: new Set<string>(), hasStrongRelation: false }
      for (const token of relationTokens) {
        existing.tokens.add(token)
      }
      existing.hasStrongRelation = existing.hasStrongRelation || hasStrongRelation
      hints.set(chunkId, existing)
    }
  }

  return hints
}

function countOccurrences(text: string, token: string): number {
  let start = 0
  let count = 0
  while (start < text.length) {
    const index = text.indexOf(token, start)
    if (index < 0) break
    count += 1
    start = index + token.length
  }
  return count
}

function scoreText(queryTokens: string[], queryLower: string, text: string): number {
  if (queryTokens.length === 0 || !text) return 0

  const lower = text.toLowerCase()
  let matched = 0
  let tf = 0
  for (const token of queryTokens) {
    const c = countOccurrences(lower, token)
    if (c > 0) {
      matched += 1
      tf += c
    }
  }

  const coverage = matched / queryTokens.length
  const tfScore = Math.min(1, tf / (queryTokens.length * 2))
  const phraseBoost = queryLower && lower.includes(queryLower) ? 0.15 : 0
  return Number((coverage * 0.7 + tfScore * 0.3 + phraseBoost).toFixed(6))
}

function queryLooksCausal(queryLower: string): boolean {
  return /(why|because|原因|机制|因果|导致|trigger|causal)/i.test(queryLower)
}

function scoreRelationBoost(
  queryTokens: string[],
  queryLower: string,
  chunkId: string,
  relationHints: Map<string, RelationHint>
): number {
  const hint = relationHints.get(chunkId)
  if (!hint || queryTokens.length === 0 || hint.tokens.size === 0) return 0

  let matched = 0
  for (const token of queryTokens) {
    if (hint.tokens.has(token)) {
      matched += 1
    }
  }

  if (matched <= 0) return 0
  const coverage = matched / queryTokens.length
  const relationBoost = Math.min(0.22, coverage * 0.22)
  const strongBoost =
    hint.hasStrongRelation && queryLooksCausal(queryLower) && coverage > 0 ? 0.06 : 0
  return Number((relationBoost + strongBoost).toFixed(6))
}

function looksLikeBase64(raw: string): boolean {
  const compact = raw.replace(/\s+/g, '')
  if (compact.length < 256 || compact.length % 4 !== 0) return false
  return /^[A-Za-z0-9+/=]+$/.test(compact)
}

function isProbablyText(raw: string): boolean {
  const sample = raw.slice(0, 12000)
  if (!sample.trim()) return false

  let controlChars = 0
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i)
    if (code === 9 || code === 10 || code === 13) continue
    if (code < 32 || code === 65533) {
      controlChars += 1
    }
  }
  const ratio = controlChars / Math.max(1, sample.length)
  return ratio < 0.08
}

function decodeDocumentText(doc: Document): string {
  const raw = (doc.file_content || '').trim()
  if (!raw) return ''

  if (looksLikeBase64(raw)) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8')
      if (isProbablyText(decoded)) return decoded
      return ''
    } catch {
      return ''
    }
  }

  return isProbablyText(raw) ? raw : ''
}

async function rebuildSemanticChunksFromContent(doc: Document): Promise<PersistedSemanticChunk[]> {
  const decoded = decodeDocumentText(doc)
  const normalized = decoded.replace(/\r/g, '').trim()
  if (!normalized) return []

  const clipped = normalized.slice(0, MAX_SCAN_CONTENT_CHARS)
  let chunks: string[] = []
  try {
    chunks = (await runSemchunk({ text: clipped }, RETRIEVER_SEMCHUNK_CHUNK_TOKENS)) as string[]
  } catch (error) {
    console.warn(`[AgenticRetriever] semchunk fallback for doc=${doc.id}:`, error)
    chunks = [clipped]
  }

  return chunks
    .map((item) => item.trim())
    .filter(Boolean)
    .map((content, index) => ({
      chunkId: `c${String(index + 1).padStart(4, '0')}`,
      content:
        content.length > MAX_CARD_CONTENT_CHARS
          ? `${content.slice(0, MAX_CARD_CONTENT_CHARS)}...`
          : content,
    }))
}

async function loadSemanticChunks(doc: Document): Promise<PersistedSemanticChunk[]> {
  const persisted = parsePersistedSemanticChunks(doc)
  if (persisted.length > 0) return persisted
  return rebuildSemanticChunksFromContent(doc)
}

async function resolveScopedDocuments(input: AgenticRetrievalInput): Promise<Document[]> {
  let scopedDocIds =
    input.documentIds && input.documentIds.length > 0
      ? Array.from(new Set(input.documentIds.filter(Boolean)))
      : []

  if (input.kbId && scopedDocIds.length > 0) {
    scopedDocIds = await filterDocumentIdsByNotebook(scopedDocIds, input.kbId, input.userId)
  }

  if (scopedDocIds.length > 0) {
    const docs = await Promise.all(scopedDocIds.map((docId) => getDocumentById(docId)))
    return docs.filter((doc): doc is Document => Boolean(doc && doc.user_id === input.userId))
  }

  if (input.kbId) {
    const docs = await getDocumentsByNotebookId(input.kbId, { limit: MAX_DOCS_PER_QUERY })
    return docs.filter((doc) => doc.user_id === input.userId)
  }

  const docs = await getDocumentsByUserId(input.userId, { limit: MAX_DOCS_PER_QUERY })
  return docs
}

function buildMetaEvidence(query: string, docs: Document[]): AgenticEvidenceCard[] {
  const total = docs.length
  const completed = docs.filter((doc) => doc.status === 'completed').length
  const latest = docs
    .slice()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5)

  const rows = latest
    .map((doc) => `- ${doc.file_name} (status=${doc.status}, created_at=${doc.created_at})`)
    .join('\n')

  const content = [
    `Meta query result for: ${query}`,
    `documents_total=${total}`,
    `documents_completed=${completed}`,
    'latest_documents:',
    rows || '(none)',
  ].join('\n')

  return [
    {
      chunkId: 'meta:documents',
      docId: 'meta',
      docName: 'system_metadata',
      content,
      score: 1,
      source: 'meta',
      metadata: {
        total,
        completed,
      },
    },
  ]
}

function shouldUseMetaFastPath(query: string, intentPrimary?: string): boolean {
  if (intentPrimary === 'M9') return true
  const lower = query.toLowerCase()
  const hints = ['有没有', '多少', '最近', '元数据', 'metadata', 'documents', 'sources']
  return hints.some((hint) => lower.includes(hint))
}

export async function retrieveAgenticEvidence(
  input: AgenticRetrievalInput
): Promise<AgenticEvidenceCard[]> {
  const limit = Math.max(1, input.limit ?? DEFAULT_EVIDENCE_LIMIT)
  const docs = await resolveScopedDocuments(input)
  if (docs.length === 0) return []
  const queryTokens = tokenize(input.query)
  const queryLower = input.query.toLowerCase()

  if (shouldUseMetaFastPath(input.query, input.intentPrimary)) {
    return buildMetaEvidence(input.query, docs)
  }

  const candidates: AgenticEvidenceCard[] = []
  for (const doc of docs) {
    const docName = doc.file_name || `doc_${doc.id.slice(0, 8)}`
    const summary = (doc.summary_global || doc.deep_summary || doc.ktype_summary || '').trim()
    const relationHints = extractRelationHints(summary)
    if (summary) {
      const summaryScore = scoreText(queryTokens, queryLower, summary) + 0.05
      candidates.push({
        chunkId: 'summary',
        docId: doc.id,
        docName,
        content: summary.length > 2600 ? `${summary.slice(0, 2600)}...` : summary,
        score: Number(summaryScore.toFixed(6)),
        source: 'summary',
      })
    }

    const semanticChunks = await loadSemanticChunks(doc)
    for (const chunk of semanticChunks) {
      const lexicalScore = scoreText(queryTokens, queryLower, chunk.content)
      const relationBoost = scoreRelationBoost(queryTokens, queryLower, chunk.chunkId, relationHints)
      const totalScore = Number((lexicalScore + relationBoost).toFixed(6))
      candidates.push({
        chunkId: chunk.chunkId,
        docId: doc.id,
        docName,
        content: chunk.content,
        score: totalScore,
        source: 'content',
        metadata: relationBoost > 0 ? { lexical_score: lexicalScore, relation_boost: relationBoost } : undefined,
      })
    }
  }

  return candidates
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
