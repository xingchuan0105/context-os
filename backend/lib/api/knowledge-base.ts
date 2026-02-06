import apiClient from './client'

export interface CreateKBRequest {
  title: string
  description?: string
}

export interface UpdateKBRequest {
  title?: string
  description?: string
}

export interface KnowledgeBase {
  id: string
  title: string
  description: string | null
  user_id: string
  created_at: string
  updated_at: string
  _count?: {
    documents: number
  }
}

export const knowledgeBaseApi = {
  // Get all knowledge bases for current user
  getAll: async () => {
    const response = await apiClient.get<{ success: boolean; data: KnowledgeBase[]; timestamp: string }>('/knowledge-bases')
    return response.data.data || []
  },

  // Get a single knowledge base
  getById: async (id: string) => {
    const response = await apiClient.get<{ success: boolean; data: KnowledgeBase; timestamp: string }>(`/knowledge-bases/${id}`)
    return response.data.data
  },

  // Create a new knowledge base
  create: async (data: CreateKBRequest) => {
    const response = await apiClient.post<{ success: boolean; data: KnowledgeBase; timestamp: string }>('/knowledge-bases', data)
    return response.data.data
  },

  // Update a knowledge base
  update: async (id: string, data: UpdateKBRequest) => {
    const response = await apiClient.put<{ success: boolean; data: KnowledgeBase; timestamp: string }>(`/knowledge-bases/${id}`, data)
    return response.data.data
  },

  // Delete a knowledge base
  delete: async (id: string) => {
    const response = await apiClient.delete<{ success: boolean; data: { success: boolean }; timestamp: string }>(`/knowledge-bases/${id}`)
    return response.data.data.success
  },
}
