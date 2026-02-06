import apiClient from './client'
import type {
  Document,
  DocumentStatus,
  UploadDocumentResponse,
  ReprocessDocumentResponse,
  DocumentStatusResponse,
} from './types'

export const documentsApi = {
  // Get documents for a knowledge base
  getByKBId: async (kbId: string) => {
    const response = await apiClient.get<{ success: boolean; data: Document[]; timestamp: string }>(`/documents?kb_id=${kbId}`)
    return response.data.data || []
  },

  // Get a single document
  getById: async (id: string) => {
    const response = await apiClient.get<{ success: boolean; data: Document; timestamp: string }>(`/documents/${id}`)
    return response.data.data
  },

  // Upload a document
  upload: async (kbId: string, file: File, autoProcess = true) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kb_id', kbId)
    formData.append('autoProcess', String(autoProcess))

    const response = await apiClient.post<{ success: boolean; data: UploadDocumentResponse; timestamp: string }>('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data.data
  },

  // Update a document
  update: async (id: string, data: Partial<Document>) => {
    const response = await apiClient.put<{ success: boolean; data: Document; timestamp: string }>(`/documents/${id}`, data)
    return response.data.data
  },

  // Delete a document
  delete: async (id: string) => {
    const response = await apiClient.delete<{ success: boolean; data: { success: boolean }; timestamp: string }>(`/documents/${id}`)
    return response.data.data.success
  },

  // Get document processing status
  getStatus: async (id: string) => {
    const response = await apiClient.get<{ success: boolean; data: DocumentStatusResponse; timestamp: string }>(`/documents/${id}/status`)
    return response.data.data
  },

  // Retry processing for a failed document
  retryProcessing: async (id: string) => {
    const response = await apiClient.post<{ success: boolean; data: ReprocessDocumentResponse; timestamp: string }>(
      `/documents/${id}/reprocess`
    )
    return response.data.data
  },
}
