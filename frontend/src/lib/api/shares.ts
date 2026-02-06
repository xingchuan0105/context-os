import { apiClient } from './client'
import {
  ContextOSAPIResponse,
  KnowledgeBaseShareListResponse,
  KnowledgeBaseShareResponse,
  CreateKnowledgeBaseShareRequest,
  SharedLinkResponse,
  SharedKnowledgeBaseSourcesResponse,
  SharedKnowledgeBaseNotesResponse,
  SharedKnowledgeBaseSourceIdsResponse,
  DocumentResponse,
  NoteResponse,
} from '@/lib/types/api'
import { unwrapContextOSResponse } from './response'

export const sharesApi = {
  listKnowledgeBaseShares: async (kbId: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<KnowledgeBaseShareListResponse> | KnowledgeBaseShareListResponse
    >(`/knowledge-bases/${kbId}/share`)
    const data = unwrapContextOSResponse(response.data)
    return data.shares
  },

  createKnowledgeBaseShare: async (
    kbId: string,
    payload: CreateKnowledgeBaseShareRequest
  ) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<KnowledgeBaseShareResponse> | KnowledgeBaseShareResponse
    >(
      `/knowledge-bases/${kbId}/share`,
      payload
    )
    return unwrapContextOSResponse(response.data)
  },

  revokeKnowledgeBaseShare: async (kbId: string, shareId: string) => {
    const response = await apiClient.delete<
      ContextOSAPIResponse<{ success: boolean }> | { success: boolean }
    >(`/knowledge-bases/${kbId}/share/${shareId}`)
    const data = unwrapContextOSResponse(response.data)
    if (data && typeof data === 'object' && 'success' in data) {
      return Boolean((data as { success: boolean }).success)
    }
    return true
  },

  getSharedLink: async (token: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<SharedLinkResponse> | SharedLinkResponse
    >(`/shared/${token}`)
    return unwrapContextOSResponse(response.data)
  },

  getSharedKnowledgeBaseSources: async (token: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<SharedKnowledgeBaseSourcesResponse> | SharedKnowledgeBaseSourcesResponse
    >(`/shared/${token}/sources`)
    const data = unwrapContextOSResponse(response.data)
    if (Array.isArray(data)) {
      return data as DocumentResponse[]
    }
    return data.documents || []
  },

  getSharedKnowledgeBaseNotes: async (token: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<SharedKnowledgeBaseNotesResponse> | SharedKnowledgeBaseNotesResponse
    >(`/shared/${token}/notes`)
    const data = unwrapContextOSResponse(response.data)
    if (Array.isArray(data)) {
      return data as NoteResponse[]
    }
    return data.notes || []
  },

  getSharedKnowledgeBaseSourceIds: async (token: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<SharedKnowledgeBaseSourceIdsResponse> | SharedKnowledgeBaseSourceIdsResponse
    >(`/shared/${token}/source-ids`)
    const data = unwrapContextOSResponse(response.data)
    if (Array.isArray(data)) {
      return data as string[]
    }
    return data.sourceIds || []
  },
}

export default sharesApi
