import { apiClient } from './client'
import { AuthUser, ContextOSAPIResponse } from '@/lib/types/api'
import { unwrapContextOSResponse } from './response'
import { USE_MOCK_DATA } from '@/lib/mock/flags'

const MOCK_USER_KEY = 'mock-auth-user'

const readMockUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(MOCK_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

const writeMockUser = (user: AuthUser | null) => {
  if (typeof window === 'undefined') return
  if (!user) {
    localStorage.removeItem(MOCK_USER_KEY)
    return
  }
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user))
}

/**
 * Context-OS Authentication API
 */
export const authApi = {
  /**
   * Login with password
   * POST /api/auth/login
   */
  login: async (email: string, password: string) => {
    if (USE_MOCK_DATA) {
      const mockUser: AuthUser = {
        id: crypto.randomUUID(),
        email,
        full_name: email.split('@')[0] || 'Mock User',
        avatar_url: null,
      }
      writeMockUser(mockUser)
      return mockUser
    }

    const response = await apiClient.post<
      ContextOSAPIResponse<{ user: AuthUser }> | { user: AuthUser }
    >(
      '/auth/login',
      { email, password }
    )
    const data = unwrapContextOSResponse(response.data)
    return data.user
  },

  /**
   * Register new user
   * POST /api/auth/register
   */
  register: async (email: string, password: string, fullName?: string) => {
    if (USE_MOCK_DATA) {
      const mockUser: AuthUser = {
        id: crypto.randomUUID(),
        email,
        full_name: fullName || email.split('@')[0] || 'Mock User',
        avatar_url: null,
      }
      writeMockUser(mockUser)
      return mockUser
    }

    const response = await apiClient.post<
      ContextOSAPIResponse<{ user: AuthUser }> | { user: AuthUser }
    >(
      '/auth/register',
      { email, password, full_name: fullName }
    )
    const data = unwrapContextOSResponse(response.data)
    return data.user
  },

  /**
   * Get current user
   * GET /api/auth/me
   */
  getCurrentUser: async () => {
    if (USE_MOCK_DATA) {
      const user = readMockUser()
      if (user) {
        return user
      }
      const error = new Error('Unauthorized')
      ;(error as { response?: { status?: number } }).response = { status: 401 }
      throw error
    }

    const response = await apiClient.get<
      ContextOSAPIResponse<{ user: AuthUser }> | { user: AuthUser }
    >('/auth/me')
    const data = unwrapContextOSResponse(response.data)
    return data.user
  },

  /**
   * Check if auth is required
   * GET /api/auth/me
   */
  checkAuthRequired: async () => {
    if (USE_MOCK_DATA) {
      return true
    }

    try {
      const response = await apiClient.get('/auth/me')
      if (response.status === 404) {
        return false
      }
      return true
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return false
      }
      return true
    }
  },

  /**
   * Logout current user
   * POST /api/auth/logout
   */
  logout: async () => {
    if (USE_MOCK_DATA) {
      writeMockUser(null)
      return true
    }

    const response = await apiClient.post<{ success: boolean }>('/auth/logout')
    return response.data.success
  },
}
