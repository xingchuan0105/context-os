/**
 * Qdrant 向量数据库客户端
 *
 * 架构设计:
 * - 每个 User 一个 Collection: user_{userId}_vectors
 * - Per-user API Key 隔离 (待实现)
 * - 支持 Parent-Child 分块模式
 *
 * @module lib/qdrant
 */

import { QdrantClient } from '@qdrant/js-client-rest'
import { incrementCounter, recordTiming } from './observability/metrics'

// ==================== 配置 ====================

// 默认使用 127.0.0.1，避免 Windows/IPv6 的 localhost 超时问题
const QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333'
const QDRANT_ROOT_KEY = process.env.QDRANT_ROOT_KEY || ''
const QDRANT_TIMEOUT_MS = parseInt(process.env.QDRANT_TIMEOUT_MS || '60000', 10)
const QDRANT_INDEXING_THRESHOLD = parseInt(process.env.QDRANT_INDEXING_THRESHOLD || '20000', 10)
const QDRANT_HNSW_M = parseInt(process.env.QDRANT_HNSW_M || '16', 10)
const QDRANT_HNSW_EF_CONSTRUCT = parseInt(process.env.QDRANT_HNSW_EF_CONSTRUCT || '128', 10)
const QDRANT_ON_DISK = process.env.QDRANT_ON_DISK === 'true'
const QDRANT_UPSERT_BATCH_SIZE = parseInt(process.env.QDRANT_UPSERT_BATCH_SIZE || '500', 10)

// Qwen3-Embedding-4B 向量维度
export const VECTOR_DIM = 2560

// ==================== 类型定义 ====================

/**
 * Chunk 类型 - 三层��构
 * - document: 文档级 (K-Type 摘要)
 * - parent: 父块级 (章节)
 * - child: 子块级 (细节)
 * - note: 笔记
 * - message: 消息
 */
export type ChunkType = 'document' | 'parent' | 'child' | 'note' | 'message'

/**
 * Point Payload 结构
 */
export interface ChunkPayload {
  // 核心关联
  doc_id: string
  kb_id: string
  user_id: string

  // 分块类型
  type: ChunkType
  parent_id?: number | string

  // 内容
  content: string
  chunk_index: number

  // 元数据
  metadata?: {
    file_name?: string
    source_url?: string
    // 父块索引 (用于 child 类型)
    parent_index?: number
    // 允许其他扩展字段
    [key: string]: unknown
  }

  // 访问控制
  access?: 'private' | 'shared'
}

// ==================== 类型适配器 ====================

/**
 * Qdrant SDK 返回的原始 Point 结构
 * @interface QdrantPoint
 */
interface QdrantPoint {
  id: string | number
  payload?: unknown
  vector?: unknown
  score?: number
}

/**
 * 类型守卫：验证 payload 是否为 ChunkPayload
 */
function isChunkPayload(payload: unknown): payload is ChunkPayload {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const p = payload as Record<string, unknown>
  return (
    typeof p.doc_id === 'string' &&
    typeof p.kb_id === 'string' &&
    typeof p.user_id === 'string' &&
    typeof p.content === 'string' &&
    typeof p.chunk_index === 'number' &&
    typeof p.type === 'string'
  )
}

/**
 * 安全地将 Qdrant Point 转换为 SearchResult
 */
function toSearchResult(point: QdrantPoint): SearchResult | null {
  if (!point.payload || !isChunkPayload(point.payload)) {
    console.warn('[Qdrant] Invalid payload structure:', point.id)
    return null
  }

  // scroll 查询不会返回 score，这里容错为 0
  const score = typeof point.score === 'number' ? point.score : 0

  return {
    id: Number(point.id),
    score,
    payload: point.payload,
  }
}

/**
 * 批量转换 Qdrant Points 为 SearchResults
 */
function toSearchResults(points: QdrantPoint[]): SearchResult[] {
  const results: SearchResult[] = []

  for (const point of points) {
    const result = toSearchResult(point)
    if (result) {
      results.push(result)
    }
  }

  return results
}

/**
 * 安全地将 Qdrant Point 转换为包含 payload 的结构
 */
function toPointWithPayload(point: QdrantPoint): { id: string | number; payload?: ChunkPayload } | null {
  if (!point.payload || !isChunkPayload(point.payload)) {
    console.warn('[Qdrant] Invalid payload structure:', point.id)
    return null
  }

  return {
    id: point.id,
    payload: point.payload,
  }
}

/**
 * 批量转换 Qdrant Points 为带 payload 的结构
 */
function toPointsWithPayload(points: QdrantPoint[]): Array<{ id: string | number; payload?: ChunkPayload }> {
  const results: Array<{ id: string | number; payload?: ChunkPayload }> = []

  for (const point of points) {
    const result = toPointWithPayload(point)
    if (result) {
      results.push(result)
    }
  }

  return results
}

/**
 * 向量点结构 (用于插入)
 */
export interface VectorPoint {
  id: number | string
  vector: number[]
  payload: ChunkPayload
}

/**
 * 搜索结果
 */
export interface SearchResult {
  id: number
  score: number
  payload: ChunkPayload
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  limit?: number
  scoreThreshold?: number
  filter?: {
    docId?: string
    kbId?: string
    type?: ChunkType
    userId?: string
  }
}

// ==================== 单例客户端 ====================

/**
 * 获取根 Qdrant 客户端 (用于管理操作)
 */
function getRootClient(): QdrantClient {
  return new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_ROOT_KEY || undefined,
    // 批量插入量大时需要更长超时
    timeout: QDRANT_TIMEOUT_MS,
    // 禁用版本检查，避免兼容性警告
    checkCompatibility: false,
  })
}

const rootClient = getRootClient()

/**
 * 获取用户级客户端 (用于普通操作)
 * TODO: 实现时使用 per-user API key
 */
export function getUserClient(userId: string): QdrantClient {
  // 生产环境应该使用 per-user API key
  // return new QdrantClient({
  //   url: QDRANT_URL,
  //   apiKey: getUserApiKey(userId),
  // })
  return rootClient
}

// ==================== Collection 管理 ====================

/**
 * 获取用户的 collection 名称
 */
export function getUserCollectionName(userId: string): string {
  return `user_${userId}_vectors`
}

/**
 * 创建用户的向量 collection
 */
export async function ensureUserCollection(userId: string): Promise<string> {
  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  try {
    const info = await client.getCollection(collectionName)
    // Collection 已存在
    return collectionName
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 404) {
      // Collection 不存在，创建新的
      await client.createCollection(collectionName, {
        vectors: {
          size: VECTOR_DIM,
          distance: 'Cosine',
        },
        // payload_schema is a valid Qdrant option but missing from TypeScript types
        payload_schema: {
          doc_id: 'keyword',
          kb_id: 'keyword',
          user_id: 'keyword',
          type: 'keyword',
          parent_id: 'integer',
          content: 'text',
          chunk_index: 'integer',
          access: 'keyword',
        },
        optimizers_config: {
          indexing_threshold: QDRANT_INDEXING_THRESHOLD,
        },
        hnsw_config: {
          m: QDRANT_HNSW_M,
          ef_construct: QDRANT_HNSW_EF_CONSTRUCT,
          on_disk: QDRANT_ON_DISK,
        },
        replication_factor: 1,
      } as any)

      // 创建 payload 索引
      await client.createPayloadIndex(collectionName, {
        field_name: 'doc_id',
        field_schema: 'keyword',
      })

      await client.createPayloadIndex(collectionName, {
        field_name: 'kb_id',
        field_schema: 'keyword',
      })

      await client.createPayloadIndex(collectionName, {
        field_name: 'type',
        field_schema: 'keyword',
      })

      return collectionName
    }
    throw e
  }
}

/**
 * 删除用户的 collection
 */
export async function deleteUserCollection(userId: string): Promise<void> {
  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  await client.deleteCollection(collectionName)
}

/**
 * 获取用户的 collection 信息
 */
export async function getUserCollectionInfo(userId: string) {
  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  return await client.getCollection(collectionName)
}

// ==================== 向量操作 ====================

/**
 * 插入/更新向量点（支持大批量分批处理）
 */
export async function upsertPoints(
  userId: string,
  points: VectorPoint[],
): Promise<void> {
  const startedAt = Date.now()
  const collectionName = await ensureUserCollection(userId)
  const client = getUserClient(userId)

  const pointsWithUserId = points.map(p => ({
    ...p,
    payload: {
      ...p.payload,
      user_id: userId,
    },
  }))

  const BATCH_SIZE = QDRANT_UPSERT_BATCH_SIZE
  const totalPoints = pointsWithUserId.length

  try {
    if (totalPoints <= BATCH_SIZE) {
      await client.upsert(collectionName, {
        points: pointsWithUserId,
      })
    } else {
      console.log(`[Qdrant] batch upsert ${totalPoints} points, batch=${BATCH_SIZE}`)
      for (let i = 0; i < totalPoints; i += BATCH_SIZE) {
        const batch = pointsWithUserId.slice(i, Math.min(i + BATCH_SIZE, totalPoints))
        await client.upsert(collectionName, {
          points: batch,
        })
        console.log(`[Qdrant] upserted ${Math.min(i + BATCH_SIZE, totalPoints)}/${totalPoints}`)
      }
      console.log(`[Qdrant] upsert completed: ${totalPoints} points`)
    }
  } catch (error) {
    incrementCounter('qdrant_upsert_error')
    throw error
  } finally {
    recordTiming('qdrant_upsert', Date.now() - startedAt, {
      points: totalPoints,
      batchSize: BATCH_SIZE,
    })
  }
}

/**
 * 删除指定文档的所有向量点
 */
export async function deleteDocumentChunks(
  userId: string,
  docId: string,
): Promise<void> {
  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  await client.delete(collectionName, {
    filter: {
      must: [
        {
          key: 'doc_id',
          match: { value: docId },
        },
      ],
    },
  })
}

/**
 * 删除指定知识库的所有向量点
 */
export async function deleteKbChunks(
  userId: string,
  kbId: string,
): Promise<void> {
  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  await client.delete(collectionName, {
    filter: {
      must: [
        {
          key: 'kb_id',
          match: { value: kbId },
        },
      ],
    },
  })
}

/**
 * Qdrant Filter 类型
 */
type FilterCondition = {
  key: string
  match: { value: string | number }
}

/**
 * 获取文档的所有向量点
 */
export async function getDocumentChunks(
  userId: string,
  docId: string,
  options: { type?: ChunkType; limit?: number } = {},
): Promise<Array<{ id: string | number; payload?: ChunkPayload }>> {
  await ensureUserCollection(userId)
  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  const must: FilterCondition[] = [
    {
      key: 'doc_id',
      match: { value: docId },
    },
  ]

  if (options.type) {
    must.push({
      key: 'type',
      match: { value: options.type },
    })
  }

  const result = await client.scroll(collectionName, {
    filter: { must },
    limit: options.limit || 1000,
    with_payload: true,
    with_vector: false,
  })

  return toPointsWithPayload(result.points)
}

// ==================== 搜索操作 ====================

/**
 * 向量搜索 (使用新的 query API)
 *
 * @description 使用 Qdrant 的 query API 进行向量搜索
 * query API 是最新的推荐方法，支持混合查询和多阶段查询
 */
export async function search(
  userId: string,
  queryVector: number[],
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  await ensureUserCollection(userId)
  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  const must: FilterCondition[] = []

  // 构建过滤条件
  if (options.filter) {
    if (options.filter.docId) {
      must.push({
        key: 'doc_id',
        match: { value: options.filter.docId },
      })
    }
    if (options.filter.kbId) {
      must.push({
        key: 'kb_id',
        match: { value: options.filter.kbId },
      })
    }
    if (options.filter.type) {
      must.push({
        key: 'type',
        match: { value: options.filter.type },
      })
    }
    if (options.filter.userId) {
      must.push({
        key: 'user_id',
        match: { value: options.filter.userId },
      })
    }
  }

  try {
    const result = await client.query(collectionName, {
      query: queryVector,
      limit: options.limit || 10,
      score_threshold: options.scoreThreshold,
      with_payload: true,
      filter: must.length > 0 ? { must } : undefined,
    })

    return toSearchResults(result.points)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status?: number }).status
      if (status === 404) {
        return []
      }
    }
    throw error
  }
}

/**
 * 混合搜索: 先向量搜索，再获取父块上下文
 *
 * @param userId 用户 ID
 * @param queryVector 查询向量
 * @param options 搜索选项
 * @param includeParent 是否包含父块上下文
 */
export async function searchWithParentContext(
  userId: string,
  queryVector: number[],
  options: SearchOptions = {},
  includeParent = true,
): Promise<Array<SearchResult & { parentContent?: string }>> {
  // 默认只搜索子块
  const searchOptions = {
    ...options,
    filter: {
      ...options.filter,
      type: 'child' as ChunkType,
    },
  }

  const results = await search(userId, queryVector, searchOptions)

  if (!includeParent) {
    return results
  }

  // 获取父块内容
  const parentIdsSet = new Set(results.map(r => r.payload.parent_id).filter(Boolean) as (string | number)[])
  const parentIds = Array.from(parentIdsSet)

  if (parentIds.length === 0) {
    return results
  }

  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  // 批量获取父块
  const parentPoints = await client.retrieve(collectionName, {
    ids: parentIds as (number | string)[],
    with_payload: true,
  })

  const parentMap = new Map<number | string, string>(
    parentPoints.map(p => [p.id as number | string, (p.payload?.content || '') as string])
  )

  // 添加父块内容到结果
  return results.map(r => ({
    ...r,
    parentContent: r.payload.parent_id ? (parentMap.get(r.payload.parent_id) || undefined) : undefined,
  }))
}

/**
 * 推荐搜索: 搜索指定知识库内的相关内容
 */
export async function searchInKb(
  userId: string,
  kbId: string,
  queryVector: number[],
  options: Omit<SearchOptions, 'filter'> = {},
): Promise<SearchResult[]> {
  return search(userId, queryVector, {
    ...options,
    filter: {
      kbId,
      type: 'child', // 只搜索子块
    },
  })
}

// ==================== 三层检索 (Drill-Down Search) ====================

/**
 * 三层检索结果
 */
export interface ThreeLayerResult {
  /** 文档级结果 */
  document: SearchResult | null
  /** 父块级结果 */
  parent: SearchResult | null
  /** 子块级结果 */
  children: SearchResult[]
}

/**
 * 三层钻取检索
 *
 * 检索流程：
 * 1. 文档级：在 K-Type 摘要中搜索，找到相关文档
 * 2. 父块级：在该文档的父块中搜索，找到相关章节
 * 3. 子块级：在该父块的子块中搜索，找到具体内容
 *
 * @param userId 用户 ID
 * @param queryVector 查询向量
 * @param options 搜索选项
 */
export async function searchWithDrillDown(
  userId: string,
  queryVector: number[],
  options: SearchOptions & {
    /** 父块搜索数量 */
    parentLimit?: number
    /** 子块搜索数量 */
    childLimit?: number
  } = {},
): Promise<ThreeLayerResult> {
  const { filter, parentLimit = 1, childLimit = 3 } = options

  // 第一层：文档级检索 (K-Type 摘要)
  let documentResult: SearchResult | null = null
  let targetDocId: string | null = null

  const docResults = await search(userId, queryVector, {
    limit: 1,
    scoreThreshold: options.scoreThreshold,
    filter: {
      ...filter,
      type: 'document',
    },
  })

  if (docResults.length > 0) {
    documentResult = docResults[0]
    targetDocId = documentResult.payload.doc_id
  }

  // 如果没有找到文档，返回空结果
  if (!targetDocId) {
    return {
      document: null,
      parent: null,
      children: [],
    }
  }

  // 第二层：父块级检索 (在该文档的父块中搜索)
  const parentResults = await search(userId, queryVector, {
    limit: parentLimit,
    scoreThreshold: options.scoreThreshold,
    filter: {
      ...filter,
      docId: targetDocId,
      type: 'parent',
    },
  })

  let parentResult: SearchResult | null = null
  let targetParentChunkIndex: number | null = null

  if (parentResults.length > 0) {
    parentResult = parentResults[0]
    targetParentChunkIndex = parentResult.payload.chunk_index as number
  }

  // 如果没有找到父块，返回文档结果
  if (targetParentChunkIndex === null) {
    return {
      document: documentResult,
      parent: null,
      children: [],
    }
  }

  // 第三层：子块级检索 (在该父块的子块中搜索)
  const childResults = await search(userId, queryVector, {
    limit: childLimit,
    scoreThreshold: options.scoreThreshold,
    filter: {
      ...filter,
      docId: targetDocId,
      type: 'child',
    },
  })

  // 过滤：只返回属于目标父块的子块（通过 parent_index 匹配 chunk_index）
  const children = childResults.filter(
    r => r.payload.metadata?.parent_index === targetParentChunkIndex
  )

  return {
    document: documentResult,
    parent: parentResult,
    children,
  }
}

/**
 * 宽松三层检索
 *
 * 与 searchWithDrillDown 的区别：
 * - 如果某层没有结果，继续搜索下一层
 * - 子块不过滤 parent_id，返回所有相关子块
 *
 * @param userId 用户 ID
 * @param queryVector 查询向量
 * @param options 搜索选项
 */
export async function searchWithDrillDownRelaxed(
  userId: string,
  queryVector: number[],
  options: SearchOptions & {
    /** 父块搜索数量 */
    parentLimit?: number
    /** 子块搜索数量 */
    childLimit?: number
  } = {},
): Promise<ThreeLayerResult> {
  const { filter, parentLimit = 1, childLimit = 5 } = options

  // 第一层：文档级检索
  let documentResult: SearchResult | null = null
  let targetDocId: string | null = null

  const docResults = await search(userId, queryVector, {
    limit: 1,
    scoreThreshold: options.scoreThreshold,
    filter: {
      ...filter,
      type: 'document',
    },
  })

  if (docResults.length > 0) {
    documentResult = docResults[0]
    targetDocId = documentResult.payload.doc_id
  }

  // 第二层：父块级检索
  let parentResult: SearchResult | null = null

  if (targetDocId) {
    const parentResults = await search(userId, queryVector, {
      limit: parentLimit,
      scoreThreshold: options.scoreThreshold,
      filter: {
        ...filter,
        docId: targetDocId,
        type: 'parent',
      },
    })

    if (parentResults.length > 0) {
      parentResult = parentResults[0]
    }
  }

  // 第三层：子块级检索
  let children: SearchResult[] = []

  if (targetDocId) {
    children = await search(userId, queryVector, {
      limit: childLimit,
      scoreThreshold: options.scoreThreshold,
      filter: {
        ...filter,
        docId: targetDocId,
        type: 'child',
      },
    })
  }

  return {
    document: documentResult,
    parent: parentResult,
    children,
  }
}

/**
 * 批量获取文档的所有层級内容
 *
 * @param userId 用户 ID
 * @param docId 文档 ID
 */
export async function getDocumentLayers(
  userId: string,
  docId: string,
): Promise<{
  document: SearchResult | null
  parents: SearchResult[]
  children: SearchResult[]
}> {
  await ensureUserCollection(userId)
  const collectionName = getUserCollectionName(userId)
  const client = getUserClient(userId)

  // 获取文档层
  const docResults = await client.scroll(collectionName, {
    filter: {
      must: [
        { key: 'doc_id', match: { value: docId } },
        { key: 'type', match: { value: 'document' } },
      ],
    },
    limit: 1,
    with_payload: true,
  })

  // 获取父块层
  const parentResults = await client.scroll(collectionName, {
    filter: {
      must: [
        { key: 'doc_id', match: { value: docId } },
        { key: 'type', match: { value: 'parent' } },
      ],
    },
    limit: 1000,
    with_payload: true,
  })

  // 获取子块层
  const childResults = await client.scroll(collectionName, {
    filter: {
      must: [
        { key: 'doc_id', match: { value: docId } },
        { key: 'type', match: { value: 'child' } },
      ],
    },
    limit: 10000,
    with_payload: true,
  })

  return {
    document: docResults.points[0] ? toSearchResult(docResults.points[0]) : null,
    parents: toSearchResults(parentResults.points),
    children: toSearchResults(childResults.points),
  }
}

// ==================== 批量操作 ====================

/**
 * 批量插入 (支持大型文档的分批处理)
 */
export async function batchUpsert(
  userId: string,
  points: VectorPoint[],
  batchSize = 100,
): Promise<void> {
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize)
    await upsertPoints(userId, batch)
  }
}

// ==================== 工具函数 ====================

/**
 * 检查 Qdrant 服务是否可用
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_URL}/`)
    const data = await response.json()
    return data.title?.includes('qdrant')
  } catch {
    return false
  }
}

/**
 * 获取所有 collection (调试用)
 */
export async function listCollections(): Promise<string[]> {
  const client = getRootClient()
  const collections = await client.getCollections()
  return collections.collections.map(c => c.name)
}

// ==================== 导出 ====================

export default {
  VECTOR_DIM,
  getUserClient,
  ensureUserCollection,
  deleteUserCollection,
  getUserCollectionInfo,
  upsertPoints,
  deleteDocumentChunks,
  deleteKbChunks,
  getDocumentChunks,
  search,
  searchWithParentContext,
  searchInKb,
  // 三层检索
  searchWithDrillDown,
  searchWithDrillDownRelaxed,
  getDocumentLayers,
  // 批量操作
  batchUpsert,
  // 工具
  healthCheck,
  listCollections,
}
