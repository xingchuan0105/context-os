import { apiClient } from './client'
import {
  DocumentResponse,
  DocumentReprocessResponse,
  DocumentStatusResponse,
  DocumentUploadResponse,
  ContextOSAPIResponse,
} from '@/lib/types/api'
import { unwrapContextOSResponse } from './response'

/**
 * Context-OS Documents API
 */
export const documentsApi = {
  /**
   * Get documents for a knowledge base
   * GET /api/documents?kb_id={id}
   */
  getByKbId: async (kbId: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<DocumentResponse[]> | DocumentResponse[]
    >(
      `/documents?kb_id=${kbId}`
    )
    return unwrapContextOSResponse(response.data)
  },

  /**
   * Get a specific document
   * GET /api/documents/{id}
   */
  getById: async (id: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<DocumentResponse> | DocumentResponse
    >(
      `/documents/${id}`
    )
    return unwrapContextOSResponse(response.data)
  },

  /**
   * Upload a document
   * POST /api/documents
   */
  upload: async (file: File, kbId: string, autoProcess = true) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kb_id', kbId)
    formData.append('autoProcess', String(autoProcess))

    const response = await apiClient.post<
      ContextOSAPIResponse<DocumentUploadResponse> | DocumentUploadResponse
    >('/documents', formData)
    const data = unwrapContextOSResponse(response.data)
    if (data && typeof data === 'object' && 'document' in data) {
      return (data as DocumentUploadResponse).document
    }
    return data as DocumentResponse
  },

  /**
   * Delete a document
   * DELETE /api/documents/{id}
   */
  delete: async (id: string) => {
    const response = await apiClient.delete<
      ContextOSAPIResponse<{ success: boolean }> | { success: boolean }
    >(`/documents/${id}`)
    const data = unwrapContextOSResponse(response.data)
    if (data && typeof data === 'object' && 'success' in data) {
      return Boolean((data as { success: boolean }).success)
    }
    return true
  },

  /**
   * Get document processing status
   * GET /api/documents/{id}/status
   */
  getStatus: async (id: string) => {
    const response = await apiClient.get<DocumentStatusResponse>(
      `/documents/${id}/status`
    )
    return response.data
  },

  /**
   * Re-process a document
   * POST /api/documents/{id}/reprocess
   */
  reprocess: async (id: string) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<DocumentReprocessResponse> | DocumentReprocessResponse
    >(`/documents/${id}/reprocess`)
    return unwrapContextOSResponse(response.data)
  },
}
