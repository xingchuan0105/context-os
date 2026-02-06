import apiClient from './client'

export interface SourceInsightResponse {
  id: string
  source_id: string
  insight_type: string
  content: string
  created: string
  updated: string
}

export interface CreateSourceInsightRequest {
  transformation_id: string
}

const normalizeSourceId = (id: string) => (id.startsWith('source:') ? id.slice(7) : id)

export const insightsApi = {
  listForSource: async (sourceId: string) => {
    const normalizedId = normalizeSourceId(sourceId)
    const response = await apiClient.get<SourceInsightResponse[]>(`/sources/${normalizedId}/insights`)
    return response.data
  },

  get: async (insightId: string) => {
    const response = await apiClient.get<SourceInsightResponse>(`/insights/${insightId}`)
    return response.data
  },

  create: async (sourceId: string, data: CreateSourceInsightRequest) => {
    const normalizedId = normalizeSourceId(sourceId)
    const response = await apiClient.post<SourceInsightResponse>(
      `/sources/${normalizedId}/insights`,
      data
    )
    return response.data
  },

  delete: async (insightId: string) => {
    await apiClient.delete(`/insights/${insightId}`)
  }
}
