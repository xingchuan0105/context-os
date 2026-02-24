import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { adminLiteLLMModelsApi } from '@/lib/api/admin-litellm-models'
import { AdminLiteLLMModelUpsertRequest } from '@/lib/types/api'

export function useAdminLiteLLMModels() {
  return useQuery({
    queryKey: QUERY_KEYS.adminLiteLLMModels,
    queryFn: () => adminLiteLLMModelsApi.list(),
  })
}

export function useCreateAdminLiteLLMModel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AdminLiteLLMModelUpsertRequest) =>
      adminLiteLLMModelsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminLiteLLMModels })
    },
  })
}

export function useUpdateAdminLiteLLMModel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ modelName, payload }: { modelName: string; payload: AdminLiteLLMModelUpsertRequest }) =>
      adminLiteLLMModelsApi.update(modelName, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminLiteLLMModels })
    },
  })
}

export function useDeleteAdminLiteLLMModel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (modelName: string) => adminLiteLLMModelsApi.remove(modelName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminLiteLLMModels })
    },
  })
}
