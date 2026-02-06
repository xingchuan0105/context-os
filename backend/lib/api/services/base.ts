/**
 * API Service Base Factory
 *
 * Generic factory for creating services with common CRUD operations
 * Eliminates boilerplate code across service implementations
 */

import type { APIClient } from '../client/index.js'

// ==================== Helper Types ====================

/**
 * Generic list operation
 */
export type ListFn<T> = () => Promise<T[]>

/**
 * Generic get by ID operation
 */
export type GetByIdFn<T> = (id: string) => Promise<T>

/**
 * Generic create operation
 */
export type CreateFn<T, TCreate> = (request: TCreate) => Promise<T>

/**
 * Generic update operation
 */
export type UpdateFn<T, TUpdate> = (request: TUpdate) => Promise<T>

/**
 * Generic delete operation
 */
export type DeleteFn = (id: string) => Promise<void>

/**
 * Resource extractor function type
 */
export type ResourceExtractor<T> = (response: any) => T

// ==================== Utility Functions ====================

/**
 * Create a resource extractor that extracts a field from the response
 *
 * @param field - Field name to extract
 * @returns Extractor function
 *
 * @example
 * const extractKB = extractResource<KnowledgeBase>('knowledgeBase')
 * const kb = extractKB(response)
 */
export function extractResource<T>(field: string): ResourceExtractor<T> {
  return (response: any) => response[field]
}

/**
 * Custom error for not implemented features
 */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet`)
    this.name = 'NotImplementedError'
  }
}

/**
 * Service configuration for common CRUD operations
 */
export interface ServiceConfig<T, TCreate, TUpdate> {
  basePath: string
  extractResource?: (response: any) => T
}

/**
 * Create a service factory with common CRUD operations
 *
 * @param client - API client instance
 * @param config - Service configuration
 * @returns Object with CRUD methods
 *
 * @example
 * const kbService = createResourceService<KnowledgeBase, CreateKBRequest, UpdateKBRequest>(
 *   client,
 *   { basePath: '/knowledge-bases', extractResource: (r) => r.knowledgeBase }
 * )
 */
export function createResourceService<T, TCreate, TUpdate>(
  client: APIClient,
  config: ServiceConfig<T, TCreate, TUpdate>
) {
  const { basePath, extractResource = (r) => r } = config

  return {
    /**
     * List all resources
     */
    list: () => client.get<T[]>(basePath),

    /**
     * Get resource by ID
     */
    getById: (id: string) => client.get<T>(`${basePath}/${id}`),

    /**
     * Create new resource
     */
    create: async (request: TCreate) => {
      const response = await client.post<any>(basePath, request)
      return extractResource(response)
    },

    /**
     * Update resource
     */
    update: async (request: TUpdate & { id: string }) => {
      const response = await client.put<any>(`${basePath}/${request.id}`, request)
      return extractResource(response)
    },

    /**
     * Delete resource
     */
    delete: (id: string) => client.delete<void>(`${basePath}/${id}`),
  }
}
