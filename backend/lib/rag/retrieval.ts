/**
 * RAG 检索模块 - 三层架构
 *
 * 检索流程：
 * 1. 文档层：在 KTYPE 报告中搜索，找到相关文档
 * 2. 父块层：在相关文档的父块中搜索，找到相关章节
 * 3. 子块层：在相关文档的子块中搜索，找到具体内容
 *
 * 最终上下文包含：文档报告 + 父块 + 子块
 */

import embeddingClient from '@/lib/embedding'
import {
  search,
  getDocumentChunks,
  type SearchResult,
  type SearchOptions,
} from '@/lib/qdrant'
import { getDocumentsByNotebookId, filterDocumentIdsByNotebook } from '@/lib/db/queries'
import { createLLMClient } from '@/lib/llm-client'
import axios from 'axios'
import { incrementCounter, recordTiming } from '@/lib/observability/metrics'

const USE_RERANK_DEFAULT = process.env.USE_RERANK !== '0'
const RERANK_MODEL = process.env.RERANK_MODEL || 'qwen3-reranker-4b'
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
const RERANK_URL = new URL('/rerank', LITELLM_BASE_URL).toString()
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-not-needed'
const RERANK_TIMEOUT_MS = parseInt(process.env.RERANK_TIMEOUT_MS || '30000')

// ==================== 类型定义 ====================

/**
 * 搜索选项扩展 - 支持文档 ID 列表过滤
 */
export interface RAGSearchOptions {
  /** 指定要搜索的文档 ID 列表（跳过文档层检索） */
  documentIds?: string[]
  /** 知识库 ID */
  kbId?: string
  /** 最小相关度阈值 */
  scoreThreshold?: number
  /** 每层返回结果数量 */
  documentLimit?: number
  documentTopK?: number
  parentLimit?: number
  childLimit?: number
  childLimitFromDocs?: number
  childLimitGlobal?: number
  childTopK?: number
  /** whether to route docs via LLM summaries (default on) */
  enableDocRouting?: boolean
  /** enable rerank on parent/child layers (default on) */
  rerank?: boolean

  /** 最大上下文长度（token 数估计） */
  maxContextLength?: number
}

/**
 * 三层检索结果
 */
export interface ThreeLayerContext {
  /** 文档层结果（KTYPE 报告） */
  document: SearchResult | null
  documents?: SearchResult[]
  /** 父块层结果（章节） */
  parents: SearchResult[]
  /** 子块层结果（细节） */
  children: SearchResult[]
}

/**
 * RAG 检索结果
 */
export interface RAGResult {
  /** 三层上下文 */
  context: ThreeLayerContext
  /** 格式化的引用数组 */
  citations: Array<{
    index: number
    content: string
    docId: string
    docName: string
    chunkIndex: number
    score: number
    layer: 'document' | 'parent' | 'child'
  }>
  /** 用于 LLM 的提示词 */
  prompt: string
  /** 原始搜索结果总数 */
  totalResults: number
}

// ==================== Helpers ====================

function safeTruncate(text: string, maxLength = 480): string {
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function parseDocRoutingResponse(content: string): string[] {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    const ids = (parsed as any).doc_ids || (parsed as any).docIds || (parsed as any).documents
    if (Array.isArray(ids)) {
      return ids.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
    }
  } catch (_err) {
    // ignore
  }
  return []
}

function normalizeDocumentIds(ids: string[]): string[] {
  return ids
    .map((id) => (id.startsWith('source:') ? id.slice(7) : id))
    .filter((id) => id && id.trim().length > 0);
}

async function selectDocumentsBySummary(
  query: string,
  kbId?: string,
  limit = 3,
): Promise<string[]> {
  if (!kbId) return []

  const docs = await getDocumentsByNotebookId(kbId)
  if (docs.length === 0) return []

  const docInfos = docs.map((doc) => ({
    id: doc.id,
    fileName: doc.file_name,
    summary: safeTruncate(doc.ktype_summary || doc.deep_summary || doc.file_content || ''),
  }))

  let docIds: string[] = []

  try {
    const llm = createLLMClient('qwen_flash')
    const listText = docInfos
      .map(
        (doc, idx) =>
          `${idx + 1}. doc_id=${doc.id}\n   file=${doc.fileName}\n   summary=${doc.summary || 'n/a'}`,
      )
      .join('\n')

    const { content } = await llm.chat(
      [
        {
          role: 'system',
          content:
            'You are a router. Given the query and doc summaries, return the most relevant doc_ids in JSON: {"doc_ids":["id1","id2"]}. Return at most the requested count and nothing else.',
        },
        {
          role: 'user',
          content: `query: ${query}\nSelect up to ${limit} docs.\nDocs:\n${listText}`,
        },
      ],
      {
        temperature: 0,
        responseFormat: { type: 'json_object' },
      },
    )

    docIds = parseDocRoutingResponse(content).slice(0, Math.max(1, limit))
  } catch (err) {
    console.warn(
      `[DocRouting] fallback to keyword filter: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (docIds.length === 0) {
    const terms = query.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean)
    docIds = docInfos
      .map((doc) => {
        const summary = doc.summary.toLowerCase()
        const score = terms.reduce((acc, term) => (summary.includes(term) ? acc + 1 : acc), 0)
        return { id: doc.id, score }
      })
      .sort((a, b) => b.score - a.score)
      .filter((d) => d.score > 0)
      .slice(0, Math.max(1, limit))
      .map((d) => d.id)
  }

  return docIds
}

async function rewriteQueryIfNeeded(
  query: string,
  topScore: number,
  threshold: number,
  maxLoop = 2
): Promise<string> {
  if (topScore >= threshold) return query

  let current = query
  for (let i = 0; i < maxLoop; i++) {
    const llm = createLLMClient('qwen_flash')
    const systemPrompt = `# Role
你是一位**搜索算法工程师**和**语义扩充专家**。

# Goal
用户的输入通常是模糊的短语。你的任务是将其重写为一个**语义稠密、指向性明确、无格式噪声**的“超级查询指令”，以便直接用于**向量数据库检索（Vector Retrieval）**。

# Core Logic: Semantic Expansion Protocol
不要回答问题，而是对原问题进行**“降噪”**与**“增益”**：

1.  **降噪 (Denoise)**：
    * 去除所有寒暄（“你好”、“请问”）。
    * 去除模糊指代（把“这个”、“它”替换为具体名词）。
    * **严禁使用Markdown标题、列表符号、分割线**，因为这些会干扰分词器。

2.  **增益 (Enrich)**：
    * **补全主语**：如果缺失，补全最可能的实体（如书名、项目名）。
    * **扩展意图**：增加同义词。例如用户问“怎么做”，扩展为“实施步骤、执行流程、具体方法”。
    * **限定语境**：增加约束条件。例如“用大白话解释”、“适合初学者”。

# Execution Rules
根据用户意图，生成一段**纯文本**指令：

* **场景 A：事实/内容检索** (用户问：是什么、讲了啥)
    * *模板：* [核心实体]的定义、核心概念、主要观点及详细解释。包括[实体]解决了什么问题，以及通俗易懂的案例分析。
* **场景 B：方法/流程检索** (用户问：怎么做、流程)
    * *模板：* 执行[任务]的具体操作指南、详细步骤列表、所需工具及避坑事项。包含从入门到完成的完整工作流。
* **场景 C：评价/分析检索** (用户问：好不好、评价)
    * *模板：* 对[实体]的深度评估、优缺点分析、适用场景对比及专家建议。包含客观的利弊权衡。

# Output Format
**只输出优化后的那一段纯文本**。不要包含“优化后的指令：”等前缀，不要换行，不要解释，不要使用任何Markdown格式。`
    const userPrompt = `# User Input
${current}`
    const { content } = await llm.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const rewritten = sanitizeRewriteOutput(content)
    if (rewritten && rewritten !== current) {
      current = rewritten
    } else {
      break
    }
  }
  return current
}

function sanitizeRewriteOutput(raw: string): string {
  if (!raw) return ''
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '---')
    .map((line) => line.replace(/^[#>*-]+\s*/g, ''))
    .map((line) => line.replace(/^(优化后的指令|改写后的查询|重写后的查询|输出|指令)[:：]\s*/i, ''))
  return lines.join(' ').replace(/\s+/g, ' ').trim()
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
      `[Rerank] rerank failed, keep original order: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
    return items
  }
}

// ==================== 核心函数 ====================

/**
 * 嵌入查询文本
 * @param query 查询文本
 * @returns 向量数组
 */
export async function embedQuery(query: string): Promise<number[]> {
  const response = await (embeddingClient as any).embeddings.create({
    // 默认使用 LiteLLM 配置的别名 qwen3-embedding-4b
    model: process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b',
    input: query,
    encoding_format: 'float',
  })

  return response.data[0].embedding
}

/**
 * 三层 RAG 检索
 *
 * @param userId 用户 ID
 * @param query 查询文本
 * @param options 检索选项
 * @returns 三层检索结果
 */
function mergeByKey(items: SearchResult[], keyFn: (item: SearchResult) => string) {
  const map = new Map<string, SearchResult>()
  for (const item of items) {
    map.set(keyFn(item), item)
  }
  return Array.from(map.values())
}

function buildChunkKey(item: SearchResult): string {
  return `${item.payload.doc_id}:${item.payload.type}:${item.payload.chunk_index}`
}

async function searchWithFallback(
  userId: string,
  queryVector: number[],
  options: SearchOptions & { limit: number },
): Promise<SearchResult[]> {
  const { limit, scoreThreshold, ...rest } = options
  const primary = await search(userId, queryVector, {
    ...rest,
    limit,
    scoreThreshold,
  })

  if (!scoreThreshold || primary.length >= limit) {
    return primary
  }

  const fallback = await search(userId, queryVector, {
    ...rest,
    limit,
  })

  return mergeByKey([...primary, ...fallback], buildChunkKey)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function getContextTopScore(context: ThreeLayerContext): number {
  const scores: number[] = []
  const docs = context.documents && context.documents.length > 0
    ? context.documents
    : context.document
      ? [context.document]
      : []
  docs.forEach((d) => scores.push(d.score))
  context.parents.forEach((p) => scores.push(p.score))
  context.children.forEach((c) => scores.push(c.score))
  return scores.length ? Math.max(...scores) : 0
}

async function getParentMap(
  userId: string,
  docId: string,
  cache: Map<string, Map<string, SearchResult>>,
): Promise<Map<string, SearchResult>> {
  if (cache.has(docId)) {
    return cache.get(docId) as Map<string, SearchResult>
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
  cache.set(docId, parentMap)
  return parentMap
}

async function retrieveSemchunkFlow(
  userId: string,
  queryVector: number[],
  query: string,
  options: {
    kbId?: string
    docScopeIds: string[]
    scoreThreshold: number
    documentLimit: number
    documentTopK: number
    childLimitFromDocs: number
    childLimitGlobal: number
    childTopK: number
    parentLimit: number
    rerank: boolean
  },
  parentCache: Map<string, Map<string, SearchResult>>,
): Promise<ThreeLayerContext> {
  const {
    kbId,
    docScopeIds,
    scoreThreshold,
    documentLimit,
    documentTopK,
    childLimitFromDocs,
    childLimitGlobal,
    childTopK,
    parentLimit,
    rerank,
  } = options
  const hasDocScope = docScopeIds.length > 0
  const filterKbId = hasDocScope ? undefined : kbId
  const docLimit = hasDocScope ? docScopeIds.length : documentLimit
  const perDocLimit = hasDocScope ? 1 : documentLimit

  console.log('[RAG retrieveSemchunkFlow] Starting:', {
    userId,
    kbId,
    filterKbId,
    hasDocScope,
    docScopeIds,
    docLimit,
    perDocLimit,
  })

  const docCandidates: SearchResult[] = []
  if (hasDocScope) {
    for (const docId of docScopeIds) {
      const docs = await searchWithFallback(userId, queryVector, {
        limit: perDocLimit,
        scoreThreshold,
        filter: { kbId: filterKbId, docId, type: 'document' },
      })
      docCandidates.push(...docs)
    }
  } else {
    const docs = await searchWithFallback(userId, queryVector, {
      limit: docLimit,
      scoreThreshold,
      filter: { kbId: filterKbId, type: 'document' },
    })
    docCandidates.push(...docs)
  }

  const docPool = mergeByKey(docCandidates, buildChunkKey)
    .sort((a, b) => b.score - a.score)
    .slice(0, docLimit)

  console.log('[RAG retrieveSemchunkFlow] docCandidates:', docCandidates.length, 'docPool:', docPool.length)

  const docRankLimit = hasDocScope
    ? docPool.length
    : Math.min(documentTopK, docPool.length)

  const docRanked = rerank
    ? await rerankLayer(query, docPool, docRankLimit, true)
    : docPool.slice(0, docRankLimit)

  // 当用户明确选择了文档（hasDocScope=true）时，不再用 scoreThreshold 过滤
  // 因为 rerank 后的 relevance_score 与向量搜索的 cosine similarity 度量标准不同
  // 用户选择的文档应该被保留，让后续流程决定相关性
  const docList = hasDocScope
    ? docRanked  // 用户选择的文档不过滤
    : docRanked.filter((doc) => doc.score >= scoreThreshold)  // 全局搜索仍然过滤

  const docIds = Array.from(new Set(docList.map((d) => d.payload.doc_id).filter(Boolean)))

  console.log('[RAG retrieveSemchunkFlow] docList:', docList.length, 'docIds:', docIds)

  const childFromDocs: SearchResult[] = []
  for (const docId of docIds) {
    const children = await searchWithFallback(userId, queryVector, {
      limit: childLimitFromDocs,
      scoreThreshold,
      filter: { kbId: filterKbId, docId, type: 'child' },
    })
    childFromDocs.push(...children)
  }

  const childGlobal = docScopeIds.length === 0 && childLimitGlobal > 0
    ? await searchWithFallback(userId, queryVector, {
        limit: childLimitGlobal,
        scoreThreshold,
        filter: { kbId: filterKbId, type: 'child' },
      })
    : []

  const mergedChildren = mergeByKey(
    [...childFromDocs, ...childGlobal],
    buildChunkKey,
  )
    .sort((a, b) => b.score - a.score)
    .slice(0, childLimitFromDocs + childLimitGlobal)

  const childTop = rerank
    ? await rerankLayer(query, mergedChildren, Math.min(childTopK, mergedChildren.length), true)
    : mergedChildren.slice(0, Math.min(childTopK, mergedChildren.length))

  console.log('[RAG retrieveSemchunkFlow] childFromDocs:', childFromDocs.length, 'childGlobal:', childGlobal.length, 'mergedChildren:', mergedChildren.length, 'childTop:', childTop.length)

  const parents: SearchResult[] = []
  const parentSeen = new Set<string>()
  for (const child of childTop) {
    const parentIndex =
      typeof (child.payload.metadata as any)?.parent_index === 'number'
        ? (child.payload.metadata as any).parent_index
        : null
    if (parentIndex === null) continue
    const key = `${child.payload.doc_id}:${parentIndex}`
    const map = await getParentMap(userId, child.payload.doc_id, parentCache)
    const parent = map.get(key)
    if (parent && !parentSeen.has(key)) {
      parentSeen.add(key)
      parents.push(parent)
    }
  }

  console.log('[RAG retrieveSemchunkFlow] Final result:', {
    documentsCount: docList.length,
    parentsCount: parents.length,
    childrenCount: childTop.length,
  })

  return {
    document: docList[0] || null,
    documents: docList,
    parents: parents.slice(0, parentLimit),
    children: childTop,
  }
}

export async function retrieveThreeLayer(
  userId: string,
  query: string,
  options: RAGSearchOptions = {}
): Promise<ThreeLayerContext> {
  const {
    documentIds,
    kbId,
    scoreThreshold = 0.3,
    documentLimit = 6,
    documentTopK = 3,
    parentLimit = 10,
    childLimit = 8,
    childLimitFromDocs = childLimit,
    childLimitGlobal = childLimit,
    childTopK = childLimit,
    enableDocRouting = true,
    rerank = USE_RERANK_DEFAULT,
  } = options

  console.log('[RAG retrieveThreeLayer] Starting with options:', {
    userId,
    kbId,
    documentIds,
    enableDocRouting,
    rerank,
    query: query.slice(0, 100),
  })

  let currentQuery = query
  let targetDocumentIds = documentIds && documentIds.length > 0 ? normalizeDocumentIds(documentIds) : []

  if (kbId && targetDocumentIds.length > 0) {
    targetDocumentIds = await filterDocumentIdsByNotebook(targetDocumentIds, kbId, userId)
  }

  if (enableDocRouting && targetDocumentIds.length === 0) {
    const routed = await selectDocumentsBySummary(currentQuery, kbId, documentLimit)
    console.log('[RAG retrieveThreeLayer] Doc routing result:', routed)
    if (routed.length > 0) {
      targetDocumentIds = routed
    }
  }

  console.log('[RAG retrieveThreeLayer] Final targetDocumentIds:', targetDocumentIds)

  const parentCache = new Map<string, Map<string, SearchResult>>()
  let context: ThreeLayerContext | null = null
  let attempt = 0

  while (attempt <= 1) {
    const queryVector = await embedQuery(currentQuery)
    context = await retrieveSemchunkFlow(
      userId,
      queryVector,
      currentQuery,
      {
        kbId,
        docScopeIds: targetDocumentIds,
        scoreThreshold,
        documentLimit,
        documentTopK,
        childLimitFromDocs,
        childLimitGlobal,
        childTopK,
        parentLimit,
        rerank,
      },
      parentCache,
    )

    const topScore = getContextTopScore(context)
    if (targetDocumentIds.length > 0 || topScore >= scoreThreshold || attempt === 1) {
      break
    }

    currentQuery = await rewriteQueryIfNeeded(currentQuery, topScore, scoreThreshold, 1)
    attempt += 1
  }

  return (
    context || {
      document: null,
      parents: [],
      children: [],
    }
  )
}

export function formatThreeLayerContext(context: ThreeLayerContext): string {
  const parts: string[] = []

  // 1. 文档层
  const documents = context.documents && context.documents.length > 0
    ? context.documents
    : context.document
      ? [context.document]
      : []

  if (documents.length > 0) {
    const docTexts = documents.map((doc, i) => {
      const docName = doc.payload.metadata?.file_name || '??'
      return `[?? ${i + 1}] ?${docName}?
${doc.payload.content}`
    })
    parts.push(`## ????
${docTexts.join('\n\n')}`)
  }

  // 2. 父块上下文（相关章节）
  if (context.parents.length > 0) {
    const parentTexts = context.parents.map((p, i) => {
      const docName = p.payload.metadata?.file_name || '文档'
      return `[章节 ${i + 1}] ${p.payload.content}\n  └─ 来自: ${docName} (相关度: ${Math.round(p.score * 100)}%)`
    })
    parts.push(`\n## 相关章节\n${parentTexts.join('\n\n')}`)
  }

  // 3. 子块细节（具体内容）
  if (context.children.length > 0) {
    const childTexts = context.children.map((c, i) => {
      const docName = c.payload.metadata?.file_name || '文档'
      return `[${i + 1}] ${c.payload.content}\n    来源: ${docName} (相关度: ${Math.round(c.score * 100)}%)`
    })
    parts.push(`\n## 详细内容\n${childTexts.join('\n\n')}`)
  }

  return parts.join('\n\n')
}

/**
 * 构建三层 RAG 提示词
 */
export function buildRAGPrompt(
  query: string,
  context: ThreeLayerContext
): string {
  const hasContent =
    (context.documents && context.documents.length > 0) ||
    context.document ||
    context.parents.length > 0 ||
    context.children.length > 0

  if (!hasContent) {
    return query
  }

  const contextText = formatThreeLayerContext(context)

  return `你是一个知识助手，基于以下参考内容回答用户问题。

参考内容按三个层级组织：
1. 文档报告：文档的 KTYPE 全量报告，帮助理解整体内容
2. 相关章节：与问题相关的章节（父块），提供上下文
3. 详细内容：与问题最相关的具体内容（子块）

${contextText}

回答要求：
- 优先使用"详细内容"中的信息
- 需要时引用"相关章节"中的上下文
- 参考内容不足时，基于"文档报告"理解后回答
- 如果参考内容完全无关，直接告知用户

问题：${query}`
}

/**
 * 格式化引用数据
 */
export function formatCitations(context: ThreeLayerContext): Array<{
  index: number
  content: string
  docId: string
  docName: string
  chunkIndex: number
  score: number
  layer: 'document' | 'parent' | 'child'
}> {
  const citations: Array<{
    index: number
    content: string
    docId: string
    docName: string
    chunkIndex: number
    score: number
    layer: 'document' | 'parent' | 'child'
  }> = []

  let index = 1

  // 文档层引用
  const documents = context.documents && context.documents.length > 0
    ? context.documents
    : context.document
      ? [context.document]
      : []

  for (const doc of documents) {
    citations.push({
      index: index++,
      content: doc.payload.content,
      docId: doc.payload.doc_id,
      docName:
        doc.payload.metadata?.file_name ||
        `?? ${doc.payload.doc_id.slice(0, 8)}`,
      chunkIndex: doc.payload.chunk_index,
      score: doc.score,
      layer: 'document',
    })
  }

  // 父块层引用
  for (const parent of context.parents) {
    citations.push({
      index: index++,
      content: parent.payload.content,
      docId: parent.payload.doc_id,
      docName:
        parent.payload.metadata?.file_name || `文档 ${parent.payload.doc_id.slice(0, 8)}`,
      chunkIndex: parent.payload.chunk_index,
      score: parent.score,
      layer: 'parent',
    })
  }

  // 子块层引用
  for (const child of context.children) {
    citations.push({
      index: index++,
      content: child.payload.content,
      docId: child.payload.doc_id,
      docName:
        child.payload.metadata?.file_name || `文档 ${child.payload.doc_id.slice(0, 8)}`,
      chunkIndex: child.payload.chunk_index,
      score: child.score,
      layer: 'child',
    })
  }

  return citations
}

/**
 * 完整的三层 RAG 检索流程
 *
 * @param userId 用户 ID
 * @param query 查询文本
 * @param options 检索选项
 * @returns RAG 检索结果
 */
export async function ragRetrieve(
  userId: string,
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGResult> {
  const startedAt = Date.now()
  try {
    const context = await retrieveThreeLayer(userId, query, options)
    const citations = formatCitations(context)
    const prompt = buildRAGPrompt(query, context)
    const docCount =
      context.documents && context.documents.length > 0
        ? context.documents.length
        : context.document
          ? 1
          : 0
    const totalResults = docCount + context.parents.length + context.children.length

    return {
      context,
      citations,
      prompt,
      totalResults,
    }
  } catch (error) {
    incrementCounter('rag_error')
    throw error
  } finally {
    recordTiming('rag', Date.now() - startedAt, {
      rerank: options.rerank ?? USE_RERANK_DEFAULT,
    })
  }
}

// ==================== 向后兼容 ====================

/**
 * 向后兼容：旧的检索接口
 * @deprecated 使用 ragRetrieve 替代
 */
export async function retrieve(
  userId: string,
  query: string,
  options: any = {}
): Promise<SearchResult[]> {
  const result = await ragRetrieve(userId, query, options)
  // 合并所有层的结果
  const results: SearchResult[] = []
  const documents = result.context.documents && result.context.documents.length > 0
    ? result.context.documents
    : result.context.document
      ? [result.context.document]
      : []
  results.push(...documents)
  results.push(...result.context.parents)
  results.push(...result.context.children)
  return results
}

/**
 * 向后兼容：旧的格式化函数
 * @deprecated 使用 formatCitations 替代
 */
export function formatSearchResults(results: SearchResult[]): Array<{
  index: number
  content: string
  docId: string
  docName: string
  chunkIndex: number
  score: number
}> {
  return results.map((result, i) => ({
    index: i + 1,
    content: result.payload.content,
    docId: result.payload.doc_id,
    docName: result.payload.metadata?.file_name || `文档 ${result.payload.doc_id.slice(0, 8)}`,
    chunkIndex: result.payload.chunk_index,
    score: result.score,
  }))
}
