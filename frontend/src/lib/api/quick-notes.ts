import { apiClient } from './client'
import { unwrapContextOSResponse } from './response'
import type {
  ContextOSAPIResponse,
  QuickNoteChatRequest,
  QuickNoteChatResponse,
  QuickNoteDetail,
  QuickNoteLabelRequest,
  QuickNoteLabelResponse,
  QuickNoteListItem,
  QuickNoteSaveRequest,
} from '@/lib/types/api'

export const quickNotesApi = {
  list: async () => {
    const response = await apiClient.get<
      ContextOSAPIResponse<QuickNoteListItem[]> | QuickNoteListItem[]
    >('/quick-notes')
    const data = unwrapContextOSResponse(response.data)
    return Array.isArray(data) ? data : []
  },

  get: async (id: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<QuickNoteDetail> | QuickNoteDetail
    >(`/quick-notes/${id}`)
    return unwrapContextOSResponse(response.data)
  },

  chat: async (payload: QuickNoteChatRequest) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<QuickNoteChatResponse> | QuickNoteChatResponse
    >('/quick-notes/chat', payload)
    return unwrapContextOSResponse(response.data)
  },

  label: async (payload: QuickNoteLabelRequest) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<QuickNoteLabelResponse> | QuickNoteLabelResponse
    >('/quick-notes/label', payload)
    return unwrapContextOSResponse(response.data)
  },

  save: async (payload: QuickNoteSaveRequest) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<QuickNoteListItem> | QuickNoteListItem
    >('/quick-notes', payload)
    return unwrapContextOSResponse(response.data)
  },

  promote: async (id: string, notebookId: string) => {
    const response = await apiClient.post(`/quick-notes/${id}/promote`, {
      notebook_id: notebookId,
    })
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete<
      ContextOSAPIResponse<{ success: boolean }> | { success: boolean }
    >(`/quick-notes/${id}`)
    const data = unwrapContextOSResponse(response.data)
    if (data && typeof data === 'object' && 'success' in data) {
      return Boolean((data as { success: boolean }).success)
    }
    return true
  },
}

export default quickNotesApi
