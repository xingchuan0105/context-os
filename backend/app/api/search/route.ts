import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import embeddingClient from '@/lib/embedding'
import {
  searchWithDrillDown,
  searchWithDrillDownRelaxed,
  searchWithParentContext,
  searchInKb,
  type ThreeLayerResult,
  type SearchResult,
} from '@/lib/qdrant'
import {
  withErrorHandler,
  success,
  UnauthorizedError,
  ValidationError,
  getRequestId,
} from '@/lib/api/errors'
import { withConcurrencyLimit } from '@/lib/api/concurrency'
import { checkRateLimit, getClientKey } from '@/lib/api/limits'

const SEARCH_CONCURRENCY_LIMIT = parseInt(process.env.SEARCH_CONCURRENCY_LIMIT || '5', 10)
const SEARCH_RATE_LIMIT_MAX = parseInt(process.env.SEARCH_RATE_LIMIT_MAX || '0', 10)
const SEARCH_RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.SEARCH_RATE_LIMIT_WINDOW_MS || '60000',
  10
)
const SEARCH_QUERY_MAX_CHARS = parseInt(process.env.SEARCH_QUERY_MAX_CHARS || '1000', 10)

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new UnauthorizedError('Please login')
  }

  if (SEARCH_RATE_LIMIT_MAX > 0) {
    const key = `search:${user.id}:${getClientKey(req)}`
    const rate = await checkRateLimit(key, SEARCH_RATE_LIMIT_MAX, SEARCH_RATE_LIMIT_WINDOW_MS)
    if (!rate.allowed) {
      throw new ValidationError('Rate limit exceeded', {
        resetAt: new Date(rate.resetAt).toISOString(),
        limit: SEARCH_RATE_LIMIT_MAX,
      })
    }
  }

  const requestId = getRequestId(req)

  return await withConcurrencyLimit('search', SEARCH_CONCURRENCY_LIMIT, async () => {
    const body = await req.json()
    const {
      query,
      kbId,
      mode = 'drill-down',
      topK = 5,
      scoreThreshold = 0,
      includeParent = true,
      rerank = false,
    } = body

    if (!query) {
      throw new ValidationError('Missing required parameter: query', { field: 'query' })
    }
    if (SEARCH_QUERY_MAX_CHARS > 0 && String(query).length > SEARCH_QUERY_MAX_CHARS) {
      throw new ValidationError('Query too long', {
        maxChars: SEARCH_QUERY_MAX_CHARS,
      })
    }

    console.log(
      `[search] requestId=${requestId} query="${String(query).slice(0, 50)}" userId=${user.id} kbId=${kbId} mode=${mode}`
    )

    const embeddingModel = process.env.EMBEDDING_MODEL || 'qwen3-embedding-4b'
    const embeddingResponse = await (embeddingClient as any).embeddings.create({
      model: embeddingModel,
      input: query,
    })

    const queryVector = embeddingResponse.data[0].embedding

    let responseData: any

    if (mode === 'drill-down') {
      const result = await searchWithDrillDown(user.id, queryVector, {
        filter: kbId ? { kbId } : undefined,
        scoreThreshold,
        parentLimit: 1,
        childLimit: topK,
      })

      responseData = formatThreeLayerResult(result)
    } else if (mode === 'drill-down-relaxed') {
      const result = await searchWithDrillDownRelaxed(user.id, queryVector, {
        filter: kbId ? { kbId } : undefined,
        scoreThreshold,
        parentLimit: 1,
        childLimit: topK,
      })

      responseData = formatThreeLayerResult(result)
    } else {
      let results: SearchResult[]

      if (kbId) {
        results = await searchInKb(user.id, kbId, queryVector, {
          limit: topK * 2,
          scoreThreshold,
        })
      } else {
        const { search } = await import('@/lib/qdrant')
        results = await search(user.id, queryVector, {
          limit: topK * 2,
          scoreThreshold,
        })
      }

      if (includeParent) {
        results = await searchWithParentContext(
          user.id,
          queryVector,
          {
            limit: topK * 2,
            scoreThreshold,
            filter: kbId ? { kbId } : undefined,
          },
          true
        )
      }

      responseData = {
        mode: 'flat',
        results: results.slice(0, topK).map((r) => ({
          content: r.payload.content,
          score: r.score,
          docId: r.payload.doc_id,
          kbId: r.payload.kb_id,
          type: r.payload.type,
          parentContent: (r as any).parentContent || null,
          metadata: r.payload.metadata,
        })),
        query,
        total: results.length,
      }
    }

    if (rerank) {
      console.log('[search] rerank requested but not implemented')
    }

    return success(responseData)
  })
})

function formatThreeLayerResult(result: ThreeLayerResult) {
  const formatted: any = {
    mode: 'drill-down',
    query: result.document?.payload.content || '',
    context: {
      document: null,
      parent: null,
      children: [],
    },
  }

  if (result.document) {
    formatted.context.document = {
      score: result.document.score,
      docId: result.document.payload.doc_id,
      kbId: result.document.payload.kb_id,
      summary: result.document.payload.content,
      metadata: result.document.payload.metadata,
    }
  }

  if (result.parent) {
    formatted.context.parent = {
      score: result.parent.score,
      content: result.parent.payload.content,
      chunkIndex: result.parent.payload.chunk_index,
    }
  }

  formatted.context.children = result.children.map((child) => ({
    score: child.score,
    content: child.payload.content,
    chunkIndex: child.payload.chunk_index,
    metadata: child.payload.metadata,
  }))

  formatted.total = 1 + (result.parent ? 1 : 0) + result.children.length

  return formatted
}
