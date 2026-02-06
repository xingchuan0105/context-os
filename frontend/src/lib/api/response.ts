import { ContextOSAPIResponse } from '@/lib/types/api'

export function unwrapContextOSResponse<T>(payload: ContextOSAPIResponse<T> | T): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as ContextOSAPIResponse<T>).data
  }

  return payload as T
}
