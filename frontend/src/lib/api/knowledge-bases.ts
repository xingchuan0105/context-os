import { apiClient } from './client'
import {
  KnowledgeBaseResponse,
  KnowledgeBaseDetailResponse,
  CreateKnowledgeBaseRequest,
  ContextOSAPIResponse,
} from '@/lib/types/api'
import { unwrapContextOSResponse } from './response'

/**
 * Context-OS Knowledge Bases API
 */
export const knowledgeBasesApi = {
  /**
   * Get all knowledge bases for the current user
   * GET /api/knowledge-bases
   */
  getAll: async () => {
    const response = await apiClient.get<
      ContextOSAPIResponse<KnowledgeBaseResponse[]> | KnowledgeBaseResponse[]
    >(
      '/knowledge-bases'
    )
    return unwrapContextOSResponse(response.data)
  },

  /**
   * Create a new knowledge base
   * POST /api/knowledge-bases
   */
  create: async (data: CreateKnowledgeBaseRequest) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<KnowledgeBaseResponse> | KnowledgeBaseResponse
    >(
      '/knowledge-bases',
      data
    )
    return unwrapContextOSResponse(response.data)
  },

  /**
   * Get a specific knowledge base
   * GET /api/knowledge-bases/{id}
   */
  getById: async (id: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<KnowledgeBaseDetailResponse> | KnowledgeBaseDetailResponse
    >(
      `/knowledge-bases/${id}`
    )
    return unwrapContextOSResponse(response.data)
  },

  /**
   * Update a knowledge base
   * PUT /api/knowledge-bases/{id}
   */
  update: async (id: string, data: Partial<KnowledgeBaseResponse>) => {
    throw new Error(
      `Knowledge base update is not supported (id=${id}, fields=${Object.keys(data).join(',')})`
    )
  },

  /**
   * Delete a knowledge base
   * DELETE /api/knowledge-bases/{id}
   */
  delete: async (id: string) => {
    const response = await apiClient.delete<
      ContextOSAPIResponse<{ success: boolean }> | { success: boolean }
    >(`/knowledge-bases/${id}`)
    const data = unwrapContextOSResponse(response.data)
    if (data && typeof data === 'object' && 'success' in data) {
      return Boolean((data as { success: boolean }).success)
    }
    return true
  },
}
