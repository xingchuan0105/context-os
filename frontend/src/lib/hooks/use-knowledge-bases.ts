import { useQuery } from '@tanstack/react-query'
import { knowledgeBasesApi } from '@/lib/api/knowledge-bases'
import { QUERY_KEYS } from '@/lib/api/query-client'

export function useKnowledgeBases() {
  return useQuery({
    queryKey: QUERY_KEYS.knowledgeBases,
    queryFn: () => knowledgeBasesApi.getAll(),
  })
}

export function useKnowledgeBaseDetail(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.knowledgeBase(id),
    queryFn: () => knowledgeBasesApi.getById(id),
    enabled: !!id,
  })
}
