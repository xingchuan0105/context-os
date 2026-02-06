import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sharesApi } from '@/lib/api/shares'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { CreateKnowledgeBaseShareRequest } from '@/lib/types/api'

export function useKnowledgeBaseShares(kbId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.knowledgeBaseShares(kbId),
    queryFn: () => sharesApi.listKnowledgeBaseShares(kbId),
    enabled: !!kbId,
  })
}

export function useCreateKnowledgeBaseShare() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ kbId, payload }: { kbId: string; payload: CreateKnowledgeBaseShareRequest }) =>
      sharesApi.createKnowledgeBaseShare(kbId, payload),
    onSuccess: (_, { kbId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.knowledgeBaseShares(kbId) })
      toast({
        title: 'Success',
        description: 'Share link created',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create share link',
        variant: 'destructive',
      })
    },
  })
}

export function useRevokeKnowledgeBaseShare() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ kbId, shareId }: { kbId: string; shareId: string }) =>
      sharesApi.revokeKnowledgeBaseShare(kbId, shareId),
    onSuccess: (_, { kbId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.knowledgeBaseShares(kbId) })
      toast({
        title: 'Success',
        description: 'Share link revoked',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revoke share link',
        variant: 'destructive',
      })
    },
  })
}

export function useSharedLink(token: string) {
  return useQuery({
    queryKey: QUERY_KEYS.sharedLink(token),
    queryFn: () => sharesApi.getSharedLink(token),
    enabled: !!token,
  })
}

export function useSharedSources(token: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.sharedSources(token),
    queryFn: () => sharesApi.getSharedKnowledgeBaseSources(token),
    enabled: !!token && (options?.enabled ?? true),
  })
}

export function useSharedNotes(token: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.sharedNotes(token),
    queryFn: () => sharesApi.getSharedKnowledgeBaseNotes(token),
    enabled: !!token && (options?.enabled ?? true),
  })
}

export function useSharedSourceIds(token: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.sharedSourceIds(token),
    queryFn: () => sharesApi.getSharedKnowledgeBaseSourceIds(token),
    enabled: !!token && (options?.enabled ?? true),
  })
}
