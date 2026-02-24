import { apiClient } from './client'
import { unwrapContextOSResponse } from './response'
import { AdminAuthUser, ContextOSAPIResponse } from '@/lib/types/api'

export const adminAuthApi = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post<
      ContextOSAPIResponse<{ user: AdminAuthUser }> | { user: AdminAuthUser }
    >('/admin/auth/login', { email, password })

    const data = unwrapContextOSResponse(response.data)
    return data.user
  },

  me: async () => {
    const response = await apiClient.get<
      ContextOSAPIResponse<{ user: AdminAuthUser }> | { user: AdminAuthUser }
    >('/admin/auth/me')

    const data = unwrapContextOSResponse(response.data)
    return data.user
  },

  logout: async () => {
    const response = await apiClient.post<
      ContextOSAPIResponse<{ success: boolean }> | { success: boolean }
    >('/admin/auth/logout')

    const data = unwrapContextOSResponse(response.data)
    return data.success
  },
}
