import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  adminMetricsApi,
  type AdminLiteLLMUsageParams,
  type AdminMetricsOverviewParams,
} from '@/lib/api/admin-metrics'

const DEFAULT_DAYS = 30
const DEFAULT_TOP_USERS = 10

function normalizeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.floor(value)
}

export function useAdminMetrics(params?: { days?: number; topUsers?: number }) {
  const days = normalizeInteger(params?.days, DEFAULT_DAYS)
  const topUsers = normalizeInteger(params?.topUsers, DEFAULT_TOP_USERS)

  return useQuery({
    queryKey: QUERY_KEYS.adminMetricsOverview(days, topUsers),
    queryFn: () => adminMetricsApi.overview({ days, topUsers }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminLiteLLMUsage(params?: { days?: number }) {
  const days = normalizeInteger(params?.days, DEFAULT_DAYS)

  return useQuery({
    queryKey: QUERY_KEYS.adminMetricsLiteLLMUsage(days),
    queryFn: () => adminMetricsApi.litellmUsage({ days }),
    placeholderData: keepPreviousData,
  })
}

export function useRefreshAdminMetrics() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params?: AdminMetricsOverviewParams) =>
      adminMetricsApi.overview({
        ...params,
        refresh: true,
      }),
    onSuccess: (data, variables) => {
      const days = normalizeInteger(variables?.days, DEFAULT_DAYS)
      const topUsers = normalizeInteger(variables?.topUsers, DEFAULT_TOP_USERS)
      queryClient.setQueryData(QUERY_KEYS.adminMetricsOverview(days, topUsers), data)
    },
  })
}

export function useRefreshAdminLiteLLMUsage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params?: AdminLiteLLMUsageParams) =>
      adminMetricsApi.litellmUsage({
        ...params,
        refresh: true,
      }),
    onSuccess: (data, variables) => {
      const days = normalizeInteger(variables?.days, DEFAULT_DAYS)
      queryClient.setQueryData(QUERY_KEYS.adminMetricsLiteLLMUsage(days), data)
    },
  })
}
