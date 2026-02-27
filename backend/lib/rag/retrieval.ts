import { incrementCounter, recordTiming } from '@/lib/observability/metrics'
import { runAgenticPlannerLoop } from '@/lib/rag/agentic'
import { embed } from '@/lib/llm'

export interface RAGSearchOptions {
  documentIds?: string[]
  kbId?: string
  scoreThreshold?: number
  documentLimit?: number
  documentTopK?: number
  parentLimit?: number
  childLimit?: number
  childLimitFromDocs?: number
  childLimitGlobal?: number
  childTopK?: number
  enableDocRouting?: boolean
  rerank?: boolean
  retrievalMode?: string
  maxContextLength?: number
}

export interface SearchResult {
  id: number
  score: number
  payload: {
    doc_id: string
    kb_id: string
    user_id: string
    type: string
    content: string
    chunk_index: number
    metadata?: Record<string, unknown>
    parent_id?: string
  }
}

export interface LinearRAGGraphRelation {
  sourceEntity: string
  targetEntity: string
  relation: string
  content: string
  docId: string
  docName: string
  score: number
}

export interface ThreeLayerContext {
  document: SearchResult | null
  documents?: SearchResult[]
  parents: SearchResult[]
  children: SearchResult[]
  summary?: SearchResult[]
  entitySentences?: SearchResult[]
  graphRelations?: LinearRAGGraphRelation[]
}

export interface RAGResult {
  context: ThreeLayerContext
  citations: Array<{
    index: number
    content: string
    docId: string
    docName: string
    chunkIndex: number
    score: number
    layer: 'document' | 'parent' | 'child' | 'summary' | 'entity_sentence' | 'graph_relation'
  }>
  prompt: string
  totalResults: number
}

// Backward-compatible helper kept for experiment modules that still call embedQuery.
export async function embedQuery(query: string): Promise<number[]> {
  const text = query.trim()
  if (!text) return []
  const response = await embed({ input: text })
  const vector = response.data?.[0]?.embedding
  if (!Array.isArray(vector)) {
    throw new Error('Failed to generate embedding vector')
  }
  return vector as number[]
}

function toLegacyResult(params: {
  index: number
  score: number
  userId: string
  docId: string
  kbId?: string
  type: string
  content: string
  chunkIndex: number
  metadata?: Record<string, unknown>
}): SearchResult {
  return {
    id: params.index + 1,
    score: params.score,
    payload: {
      doc_id: params.docId,
      kb_id: params.kbId || '',
      user_id: params.userId,
      type: params.type,
      content: params.content,
      chunk_index: params.chunkIndex,
      metadata: params.metadata,
    },
  }
}

function parseChunkIndex(chunkId: string): number {
  const match = chunkId.match(/(?:^|#)c(\d{1,6})$/i)
  return match ? Number(match[1]) : 0
}

function formatLayerLabel(type: string): 'document' | 'parent' | 'child' | 'summary' | 'entity_sentence' | 'graph_relation' {
  if (type === 'document_summary') return 'summary'
  if (type === 'entity_sentence') return 'entity_sentence'
  if (type === 'graph_relation') return 'graph_relation'
  if (type === 'parent') return 'parent'
  if (type === 'document') return 'document'
  return 'child'
}

export function formatThreeLayerContext(context: ThreeLayerContext): string {
  const lines: string[] = []
  const summaryDocs = context.summary || []
  const docLayer =
    summaryDocs.length > 0
      ? summaryDocs
      : context.documents && context.documents.length > 0
        ? context.documents
        : context.document
          ? [context.document]
          : []
  if (docLayer.length > 0) {
    lines.push('## 文档摘要')
    for (const [idx, doc] of docLayer.entries()) {
      const name = String(doc.payload.metadata?.file_name || `doc_${doc.payload.doc_id.slice(0, 8)}`)
      lines.push(`[D${idx + 1}] ${name}\n${doc.payload.content}`)
    }
  }
  if (context.children.length > 0) {
    lines.push('\n## 检索证据')
    for (const [idx, child] of context.children.entries()) {
      const name = String(child.payload.metadata?.file_name || `doc_${child.payload.doc_id.slice(0, 8)}`)
      lines.push(`[C${idx + 1}] ${name}\n${child.payload.content}`)
    }
  }
  return lines.join('\n\n')
}

export function buildRAGPrompt(query: string, context: ThreeLayerContext): string {
  const contextText = formatThreeLayerContext(context)
  if (!contextText.trim()) return query
  return `你是一个知识助手，请严格基于参考证据回答问题。\n\n${contextText}\n\n问题：${query}`
}

export function formatCitations(context: ThreeLayerContext): Array<{
  index: number
  content: string
  docId: string
  docName: string
  chunkIndex: number
  score: number
  layer: 'document' | 'parent' | 'child' | 'summary' | 'entity_sentence' | 'graph_relation'
}> {
  const rows: Array<{
    index: number
    content: string
    docId: string
    docName: string
    chunkIndex: number
    score: number
    layer: 'document' | 'parent' | 'child' | 'summary' | 'entity_sentence' | 'graph_relation'
  }> = []

  const pushRows = (items: SearchResult[]) => {
    for (const item of items) {
      rows.push({
        index: rows.length + 1,
        content: item.payload.content,
        docId: item.payload.doc_id,
        docName: String(item.payload.metadata?.file_name || `doc_${item.payload.doc_id.slice(0, 8)}`),
        chunkIndex: item.payload.chunk_index,
        score: item.score,
        layer: formatLayerLabel(item.payload.type),
      })
    }
  }

  pushRows(context.summary || [])
  pushRows(context.documents || (context.document ? [context.document] : []))
  pushRows(context.parents)
  pushRows(context.children)
  pushRows(context.entitySentences || [])
  return rows
}

export async function ragRetrieve(
  userId: string,
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGResult> {
  const startedAt = Date.now()
  try {
    const planner = await runAgenticPlannerLoop({
      userId,
      userQuery: query,
      fullOntologySummary: '',
      kbId: options.kbId,
      documentIds: options.documentIds,
      maxRounds: 6,
    })

    const evidence = planner.evidence
      .filter((item) => (options.scoreThreshold ?? 0) <= item.score)
      .sort((a, b) => b.score - a.score)

    const summary = evidence
      .filter((item) => item.source === 'summary')
      .slice(0, Math.max(1, options.documentLimit ?? 3))
      .map((item, index) =>
        toLegacyResult({
          index,
          score: item.score,
          userId,
          docId: item.docId,
          kbId: options.kbId,
          type: 'document_summary',
          content: item.content,
          chunkIndex: 0,
          metadata: { file_name: item.docName, chunk_id: item.chunkId, source: item.source },
        })
      )

    const children = evidence
      .filter((item) => item.source !== 'summary')
      .slice(0, Math.max(1, options.childLimit ?? 8))
      .map((item, index) =>
        toLegacyResult({
          index,
          score: item.score,
          userId,
          docId: item.docId,
          kbId: options.kbId,
          type: 'child',
          content: item.content,
          chunkIndex: parseChunkIndex(item.chunkId),
          metadata: { file_name: item.docName, chunk_id: item.chunkId, source: item.source },
        })
      )

    const context: ThreeLayerContext = {
      document: summary[0] || null,
      documents: [],
      parents: [],
      children,
      summary,
      entitySentences: [],
      graphRelations: [],
    }

    const citations = formatCitations(context)
    const prompt = buildRAGPrompt(query, context)
    return {
      context,
      citations,
      prompt,
      totalResults: citations.length,
    }
  } catch (error) {
    incrementCounter('rag_error')
    throw error
  } finally {
    recordTiming('rag', Date.now() - startedAt)
  }
}

export async function retrieve(
  userId: string,
  query: string,
  options: RAGSearchOptions = {}
): Promise<SearchResult[]> {
  const result = await ragRetrieve(userId, query, options)
  const docs = result.context.documents && result.context.documents.length > 0
    ? result.context.documents
    : result.context.document
      ? [result.context.document]
      : []
  return [...docs, ...result.context.parents, ...result.context.children]
}

export function formatSearchResults(results: SearchResult[]): Array<{
  index: number
  content: string
  docId: string
  docName: string
  chunkIndex: number
  score: number
}> {
  return results.map((result, index) => ({
    index: index + 1,
    content: result.payload.content,
    docId: result.payload.doc_id,
    docName: String(result.payload.metadata?.file_name || `doc_${result.payload.doc_id.slice(0, 8)}`),
    chunkIndex: result.payload.chunk_index,
    score: result.score,
  }))
}
