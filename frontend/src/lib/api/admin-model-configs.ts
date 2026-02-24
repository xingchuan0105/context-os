import { apiClient } from './client'
import { unwrapContextOSResponse } from './response'
import {
  AdminModelCapability,
  AdminModelCapabilityMeta,
  AdminModelConfigGetResponse,
  AdminModelConfigListResponse,
  AdminModelConfigTestRequest,
  AdminModelConfigTestResponse,
  AdminModelConfigUpdateRequest,
  AdminModelConfigUpdateResponse,
  ContextOSAPIResponse,
} from '@/lib/types/api'

export type AdminModelConfigAuditLog = {
  id: string
  capability: AdminModelCapability
  action: 'create' | 'update' | 'test'
  changedFields: Record<string, unknown>
  operatorUserId: string | null
  operatorEmail: string | null
  createdAt: string
}

export const adminModelConfigsApi = {
  list: async () => {
    const response = await apiClient.get<
      ContextOSAPIResponse<AdminModelConfigListResponse> | AdminModelConfigListResponse
    >('/admin/model-configs')
    return unwrapContextOSResponse(response.data)
  },

  capabilities: async () => {
    const response = await apiClient.get<
      ContextOSAPIResponse<{ capabilities: AdminModelCapabilityMeta[] }> | { capabilities: AdminModelCapabilityMeta[] }
    >('/admin/model-configs/capabilities')
    return unwrapContextOSResponse(response.data)
  },

  get: async (capability: AdminModelCapability) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<AdminModelConfigGetResponse> | AdminModelConfigGetResponse
    >(`/admin/model-configs/${capability}`)
    return unwrapContextOSResponse(response.data)
  },

  update: async (capability: AdminModelCapability, payload: AdminModelConfigUpdateRequest) => {
    const response = await apiClient.put<
      ContextOSAPIResponse<AdminModelConfigUpdateResponse> | AdminModelConfigUpdateResponse
    >(`/admin/model-configs/${capability}`, payload)
    return unwrapContextOSResponse(response.data)
  },

  test: async (capability: AdminModelCapability, payload: AdminModelConfigTestRequest) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<AdminModelConfigTestResponse> | AdminModelConfigTestResponse
    >(`/admin/model-configs/${capability}/test`, payload)
    return unwrapContextOSResponse(response.data)
  },

  auditLogs: async (limit: number = 30) => {
    const response = await apiClient.get<
      ContextOSAPIResponse<{ logs: AdminModelConfigAuditLog[] }> | { logs: AdminModelConfigAuditLog[] }
    >('/admin/model-configs/audit-logs', {
      params: { limit },
    })
    return unwrapContextOSResponse(response.data)
  },
}
