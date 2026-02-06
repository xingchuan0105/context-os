/**
 * Documents Service
 *
 * High-level service methods for document management
 * Abstracts raw API calls and provides data transformation
 */

import type {
  Document,
  DocumentStatus,
  UploadDocumentRequest,
  UploadDocumentResponse,
  ListDocumentsRequest,
  ListDocumentsResponse,
} from '../types'
import { apiClient, type APIClient } from '../client/index.js'
import { createResourceService, extractResource, NotImplementedError } from './base.js'

// ==================== Service Interface ====================

export interface DocumentsService {
  list(request: ListDocumentsRequest): Promise<ListDocumentsResponse>
  upload(request: UploadDocumentRequest): Promise<UploadDocumentResponse>
  getById(id: string): Promise<Document>
  delete(id: string): Promise<void>
}

// ==================== Implementation ====================

/**
 * Documents Service Implementation
 */
class DocumentsServiceImpl implements DocumentsService {
  private base: ReturnType<typeof createResourceService<Document, any, any>>

  constructor(private client: APIClient = apiClient) {
    // Use base service for CRUD operations
    this.base = createResourceService<Document, any, any>(this.client, {
      basePath: '/documents',
      extractResource: extractResource<Document>('document'),
    })
  }

  /**
   * List all documents in a knowledge base
   */
  async list(request: ListDocumentsRequest): Promise<ListDocumentsResponse> {
    const params: Record<string, string | undefined> = {
      kb_id: request.kbId,
    }

    if (request.status) {
      params.status = request.status
    }

    if (request.search) {
      params.search = request.search
    }

    return this.client.get<ListDocumentsResponse>('/documents', params)
  }

  /**
   * Upload a new document
   */
  async upload(request: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    const formData = new FormData()
    formData.append('file', request.file)
    formData.append('kb_id', request.kbId)

    if (request.autoProcess !== undefined) {
      formData.append('autoProcess', String(request.autoProcess))
    }

    return this.client.post<UploadDocumentResponse>('/documents', formData, {
      headers: {
        // Don't set Content-Type for FormData, let browser set it
      },
    })
  }

  /**
   * Get a document by ID
   */
  async getById(id: string): Promise<Document> {
    return this.base.getById(id)
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<void> {
    return this.base.delete(id)
  }

  /**
   * Get documents by status
   */
  async getByStatus(kbId: string, status: DocumentStatus): Promise<Document[]> {
    return this.list({ kbId, status })
  }

  /**
   * Search documents by name
   */
  async search(kbId: string, searchTerm: string): Promise<Document[]> {
    return this.list({ kbId, search: searchTerm })
  }

  /**
   * Upload multiple documents
   */
  async uploadMultiple(
    files: File[],
    kbId: string,
    onProgress?: (progress: { current: number; total: number; file: string }) => void
  ): Promise<UploadDocumentResponse[]> {
    const results: UploadDocumentResponse[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (onProgress) {
        onProgress({ current: i + 1, total: files.length, file: file.name })
      }

      try {
        const result = await this.upload({ file, kbId })
        results.push(result)
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        throw error
      }
    }

    return results
  }
}

// ==================== Default Instance ====================

/**
 * Default documents service instance
 */
export const documentsService = new DocumentsServiceImpl()

/**
 * Create a new documents service with custom client
 */
export function createDocumentsService(client?: APIClient): DocumentsService {
  return new DocumentsServiceImpl(client)
}
