import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { adminAuthApi } from '@/lib/api/admin-auth'

const ADMIN_ME_QUERY_KEY = ['admin-auth', 'me'] as const

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401
}

export function useAdminMe() {
  return useQuery({
    queryKey: ADMIN_ME_QUERY_KEY,
    queryFn: () => adminAuthApi.me(),
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error)) {
        return false
      }
      return failureCount < 1
    },
  })
}

export function useAdminLogin() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      adminAuthApi.login(email, password),
    onSuccess: (user) => {
      client.setQueryData(ADMIN_ME_QUERY_KEY, user)
    },
  })
}

export function useAdminLogout() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () => adminAuthApi.logout(),
    onSettled: () => {
      client.removeQueries({ queryKey: ADMIN_ME_QUERY_KEY })
      client.removeQueries({ queryKey: ['admin-metrics'] })
      client.removeQueries({ queryKey: ['admin-model-configs'] })
      client.removeQueries({ queryKey: ['admin-model-config-capabilities'] })
      client.removeQueries({ queryKey: ['admin-litellm-models'] })
    },
  })
}
