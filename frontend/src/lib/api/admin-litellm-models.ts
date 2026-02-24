import { apiClient } from './client'
import { unwrapContextOSResponse } from './response'
import {
  AdminLiteLLMModelListResponse,
  AdminLiteLLMModelSecretResponse,
  AdminLiteLLMModelUpsertRequest,
  ContextOSAPIResponse,
} from '@/lib/types/api'

export const adminLiteLLMModelsApi = {
  list: async () => {
    const response = await apiClient.get<
      ContextOSAPIResponse<AdminLiteLLMModelListResponse> | AdminLiteLLMModelListResponse
    >('/admin/litellm/models')

    return unwrapContextOSResponse(response.data)
  },

  create: async (payload: AdminLiteLLMModelUpsertRequest) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<AdminLiteLLMModelListResponse> | AdminLiteLLMModelListResponse
    >('/admin/litellm/models', payload)

    return unwrapContextOSResponse(response.data)
  },

  update: async (modelName: string, payload: AdminLiteLLMModelUpsertRequest) => {
    const response = await apiClient.put<
      ContextOSAPIResponse<AdminLiteLLMModelListResponse> | AdminLiteLLMModelListResponse
    >(`/admin/litellm/models/${encodeURIComponent(modelName)}`, payload)

    return unwrapContextOSResponse(response.data)
  },

  getSecret: async (modelName: string) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<AdminLiteLLMModelSecretResponse> | AdminLiteLLMModelSecretResponse
    >(`/admin/litellm/models/${encodeURIComponent(modelName)}`)

    return unwrapContextOSResponse(response.data)
  },

  remove: async (modelName: string) => {
    const response = await apiClient.delete<
      ContextOSAPIResponse<AdminLiteLLMModelListResponse> | AdminLiteLLMModelListResponse
    >(`/admin/litellm/models/${encodeURIComponent(modelName)}`)

    return unwrapContextOSResponse(response.data)
  },
}
