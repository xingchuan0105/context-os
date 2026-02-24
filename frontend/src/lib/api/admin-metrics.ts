import { apiClient } from './client'
import { unwrapContextOSResponse } from './response'
import {
  AdminLiteLLMUsageResponse,
  AdminMetricsOverviewResponse,
  ContextOSAPIResponse,
} from '@/lib/types/api'

export interface AdminMetricsOverviewParams {
  days?: number
  topUsers?: number
  refresh?: boolean
}

export interface AdminLiteLLMUsageParams {
  days?: number
  refresh?: boolean
}

export const adminMetricsApi = {
  overview: async (params: AdminMetricsOverviewParams = {}) => {
    const requestParams: Record<string, string | number> = {}

    if (typeof params.days === 'number' && Number.isFinite(params.days)) {
      requestParams.days = params.days
    }

    if (typeof params.topUsers === 'number' && Number.isFinite(params.topUsers)) {
      requestParams.topUsers = params.topUsers
    }

    if (params.refresh) {
      requestParams.refresh = 1
    }

    const response = await apiClient.get<
      ContextOSAPIResponse<AdminMetricsOverviewResponse> | AdminMetricsOverviewResponse
    >('/admin/metrics/overview', {
      params: requestParams,
    })

    return unwrapContextOSResponse(response.data)
  },

  litellmUsage: async (params: AdminLiteLLMUsageParams = {}) => {
    const requestParams: Record<string, string | number> = {}

    if (typeof params.days === 'number' && Number.isFinite(params.days)) {
      requestParams.days = params.days
    }

    if (params.refresh) {
      requestParams.refresh = 1
    }

    const response = await apiClient.get<
      ContextOSAPIResponse<AdminLiteLLMUsageResponse> | AdminLiteLLMUsageResponse
    >('/admin/metrics/litellm-usage', {
      params: requestParams,
    })

    return unwrapContextOSResponse(response.data)
  },
}
