import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminModelConfigsApi } from '@/lib/api/admin-model-configs'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  AdminModelCapability,
  AdminModelConfigTestRequest,
  AdminModelConfigUpdateRequest,
} from '@/lib/types/api'

export function useAdminModelConfigs() {
  return useQuery({
    queryKey: QUERY_KEYS.adminModelConfigs,
    queryFn: () => adminModelConfigsApi.list(),
  })
}

export function useAdminModelConfigCapabilities() {
  return useQuery({
    queryKey: QUERY_KEYS.adminModelConfigCapabilities,
    queryFn: () => adminModelConfigsApi.capabilities(),
  })
}

export function useAdminModelConfig(capability?: AdminModelCapability) {
  return useQuery({
    queryKey: QUERY_KEYS.adminModelConfig(capability || ''),
    queryFn: () => adminModelConfigsApi.get(capability as AdminModelCapability),
    enabled: Boolean(capability),
  })
}

export function useAdminModelConfigAuditLogs(limit: number = 30) {
  return useQuery({
    queryKey: ['admin-model-config-audit-logs', String(limit)] as const,
    queryFn: () => adminModelConfigsApi.auditLogs(limit),
  })
}

export function useUpdateAdminModelConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ capability, payload }: { capability: AdminModelCapability; payload: AdminModelConfigUpdateRequest }) =>
      adminModelConfigsApi.update(capability, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminModelConfigs })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminModelConfig(variables.capability) })
      queryClient.invalidateQueries({ queryKey: ['admin-model-config-audit-logs'] })
    },
  })
}

export function useTestAdminModelConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ capability, payload }: { capability: AdminModelCapability; payload: AdminModelConfigTestRequest }) =>
      adminModelConfigsApi.test(capability, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-model-config-audit-logs'] })
    },
  })
}
