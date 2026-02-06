/**
 * Search Service
 *
 * High-level service methods for semantic search and RAG retrieval
 */

import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  DrillDownSearchResponse,
  FlatSearchResponse,
} from '../types'
import { apiClient, type APIClient } from '../client/index.js'

// ==================== Service Interface ====================

export interface SearchService {
  search(request: SearchRequest): Promise<SearchResponse>
  searchInKnowledgeBase(kbId: string, query: string, topK?: number): Promise<SearchResult[]>
  drillDownSearch(query: string, kbId?: string, topK?: number): Promise<DrillDownSearchResponse>
  flatSearch(query: string, kbId?: string, topK?: number): Promise<FlatSearchResponse>
}

// ==================== Implementation ====================

/**
 * Search Service Implementation
 */
class SearchServiceImpl implements SearchService {
  constructor(private client: APIClient = apiClient) {}

  /**
   * Perform a semantic search
   *
   * @param request - Search request
   * @returns Promise of search response
   *
   * @example
   * const results = await searchService.search({
   *   query: 'What is machine learning?',
   *   kbId: 'kb-123',
   *   mode: 'drill-down',
   *   topK: 5
   * })
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    return this.client.post<SearchResponse>('/search', request)
  }

  /**
   * Search within a specific knowledge base (convenience method)
   *
   * @param kbId - Knowledge base ID
   * @param query - Search query
   * @param topK - Number of results to return
   * @returns Promise of search results
   *
   * @example
   * const results = await searchService.searchInKnowledgeBase(
   *   'kb-123',
   *   'machine learning basics',
   *   10
   * )
   */
  async searchInKnowledgeBase(
    kbId: string,
    query: string,
    topK: number = 5
  ): Promise<SearchResult[]> {
    const response = await this.search({
      query,
      kbId,
      mode: 'flat',
      topK,
      includeParent: true,
    })

    if (response.mode === 'flat') {
      return response.results
    }

    // For drill-down mode, extract child chunks as results
    return response.context.children.map((child) => ({
      content: child.content,
      score: child.score,
      docId: response.context.document?.docId || '',
      kbId: response.context.document?.kbId || kbId,
      type: 'child',
      parentContent: response.context.parent?.content || null,
      metadata: child.metadata,
    }))
  }

  /**
   * Perform drill-down search (三层钻取检索)
   *
   * @param query - Search query
   * @param kbId - Optional knowledge base ID
   * @param topK - Number of results to return
   * @returns Promise of drill-down search response
   *
   * @example
   * const result = await searchService.drillDownSearch(
   *   'What is RAG?',
   *   'kb-123',
   *   5
   * )
   *
   * console.log('Document context:', result.context.document)
   * console.log('Parent context:', result.context.parent)
   * console.log('Child chunks:', result.context.children)
   */
  async drillDownSearch(
    query: string,
    kbId?: string,
    topK: number = 5
  ): Promise<DrillDownSearchResponse> {
    const response = await this.search({
      query,
      kbId,
      mode: 'drill-down',
      topK,
    })

    if (response.mode !== 'drill-down') {
      throw new Error('Expected drill-down mode but got flat mode')
    }

    return response
  }

  /**
   * Perform flat search (平面检索)
   *
   * @param query - Search query
   * @param kbId - Optional knowledge base ID
   * @param topK - Number of results to return
   * @returns Promise of flat search response
   *
   * @example
   * const result = await searchService.flatSearch(
   *   'machine learning',
   *   'kb-123',
   *   10
   * )
   *
   * console.log('Results:', result.results)
   */
  async flatSearch(
    query: string,
    kbId?: string,
    topK: number = 5
  ): Promise<FlatSearchResponse> {
    const response = await this.search({
      query,
      kbId,
      mode: 'flat',
      topK,
      includeParent: true,
    })

    if (response.mode !== 'flat') {
      throw new Error('Expected flat mode but got drill-down mode')
    }

    return response
  }

  /**
   * Quick search with automatic mode selection
   *
   * This method automatically chooses the best search mode based on:
   * - Query length (short queries use drill-down, long queries use flat)
   * - Knowledge base availability
   *
   * @param query - Search query
   * @param kbId - Optional knowledge base ID
   * @param topK - Number of results to return
   * @returns Promise of search response
   *
   * @example
   * const result = await searchService.quickSearch(
   *   'RAG retrieval',
   *   'kb-123',
   *   5
   * )
   */
  async quickSearch(
    query: string,
    kbId?: string,
    topK: number = 5
  ): Promise<SearchResponse> {
    // Auto-select mode based on query length
    const mode = query.length < 100 ? 'drill-down' : 'flat'

    return this.search({
      query,
      kbId,
      mode,
      topK,
    })
  }

  /**
   * Semantic similarity search
   *
   * Search for semantically similar content to the query
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Promise of search results
   *
   * @example
   * const similar = await searchService.semanticSearch(
   *   'deep learning',
   *   {
   *     kbId: 'kb-123',
   *     topK: 5,
   *     scoreThreshold: 0.7
   *   }
   * )
   */
  async semanticSearch(
    query: string,
    options: {
      kbId?: string
      topK?: number
      scoreThreshold?: number
    } = {}
  ): Promise<SearchResult[]> {
    const { kbId, topK = 5, scoreThreshold = 0 } = options

    const response = await this.flatSearch(query, kbId, topK)

    // Filter by score threshold
    return response.results.filter((result) => result.score >= scoreThreshold)
  }
}

// ==================== Default Instance ====================

/**
 * Default search service instance
 *
 * @example
 * import { searchService } from '@/lib/api/services'
 * const results = await searchService.search({ query: 'RAG system' })
 */
export const searchService = new SearchServiceImpl()

/**
 * Create a new search service with custom client
 *
 * @param client - Custom API client
 * @returns SearchService instance
 *
 * @example
 * import { createAPIClient } from '@/lib/api/client'
 * import { createSearchService } from '@/lib/api/services'
 *
 * const client = createAPIClient({ baseURL: '/api' })
 * const service = createSearchService(client)
 */
export function createSearchService(client?: APIClient): SearchService {
  return new SearchServiceImpl(client)
}
