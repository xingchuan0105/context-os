/**
 * Knowledge Bases Service
 *
 * High-level service methods for knowledge base management
 */

import type {
  KnowledgeBase,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  DeleteKnowledgeBaseRequest,
  ListKnowledgeBasesResponse,
} from '../types'
import { apiClient, type APIClient } from '../client/index.js'
import { createResourceService, extractResource, NotImplementedError } from './base.js'

// ==================== Service Interface ====================

export interface KnowledgeBasesService {
  list(): Promise<ListKnowledgeBasesResponse>
  create(request: CreateKnowledgeBaseRequest): Promise<KnowledgeBase>
  update(request: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase>
  delete(request: DeleteKnowledgeBaseRequest): Promise<void>
  getById(id: string): Promise<KnowledgeBase>
}

// ==================== Implementation ====================

/**
 * Knowledge Bases Service Implementation
 */
class KnowledgeBasesServiceImpl implements KnowledgeBasesService {
  private base: ReturnType<typeof createResourceService<KnowledgeBase, any, any>>

  constructor(private client: APIClient = apiClient) {
    // Use base service for CRUD operations
    this.base = createResourceService<KnowledgeBase, any, any>(this.client, {
      basePath: '/knowledge-bases',
      extractResource: extractResource<KnowledgeBase>('knowledgeBase'),
    })
  }

  /**
   * List all knowledge bases for the current user
   */
  async list(): Promise<ListKnowledgeBasesResponse> {
    return this.client.get<ListKnowledgeBasesResponse>('/knowledge-bases')
  }

  /**
   * Create a new knowledge base
   */
  async create(request: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    return this.base.create(request)
  }

  /**
   * Update a knowledge base
   */
  async update(request: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    const response = await this.client.put<{ knowledgeBase: KnowledgeBase }>(
      `/knowledge-bases/${request.id}`,
      {
        name: request.name,
        description: request.description,
      }
    )
    return response.knowledgeBase
  }

  /**
   * Delete a knowledge base
   */
  async delete(request: DeleteKnowledgeBaseRequest): Promise<void> {
    return this.base.delete(request.id)
  }

  /**
   * Get a knowledge base by ID
   */
  async getById(id: string): Promise<KnowledgeBase> {
    return this.base.getById(id)
  }

  /**
   * Get knowledge base statistics
   */
  async getStats(id: string): Promise<{
    documentCount: number
    totalSize: number
    lastUpdated: string
  }> {
    throw new NotImplementedError('getStats')
  }
}

// ==================== Default Instance ====================

/**
 * Default knowledge bases service instance
 */
export const knowledgeBasesService = new KnowledgeBasesServiceImpl()

/**
 * Create a new knowledge bases service with custom client
 */
export function createKnowledgeBasesService(client?: APIClient): KnowledgeBasesService {
  return new KnowledgeBasesServiceImpl(client)
}
