import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api/auth-context-os'
import { AuthUser } from '@/lib/types/api'

interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  lastAuthCheck: number | null
  isCheckingAuth: boolean
  hasHydrated: boolean
  authRequired: boolean | null
  setHasHydrated: (state: boolean) => void
  checkAuthRequired: () => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, fullName?: string) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<boolean>
}

const getStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined
  const err = error as { response?: { status?: number } }
  return err.response?.status
}

const isNetworkError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const err = error as { response?: unknown; code?: string; message?: string }
  if (err.response) return false
  if (err.code === 'ERR_NETWORK') return true
  return Boolean(err.message && err.message.includes('Network Error'))
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      lastAuthCheck: null,
      isCheckingAuth: false,
      hasHydrated: false,
      authRequired: null,

      setHasHydrated: (state: boolean) => {
        set({ hasHydrated: state })
      },

      checkAuthRequired: async () => {
        try {
          const user = await authApi.getCurrentUser()
          set({ authRequired: true, isAuthenticated: true, user, error: null })
          return true
        } catch (error) {
          const status = getStatus(error)

          if (status === 401) {
            set({ authRequired: true, isAuthenticated: false, user: null })
            return true
          }

          if (status === 404) {
            set({ authRequired: false, isAuthenticated: true, user: null })
            return false
          }

          if (isNetworkError(error)) {
            set({
              error: 'Unable to connect to server. Please check if the API is running.',
              authRequired: null,
            })
          } else {
            set({
              error: 'Authentication check failed. Please try again.',
              authRequired: null,
            })
          }

          throw error
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const user = await authApi.login(email, password)
          set({
            isAuthenticated: true,
            user,
            isLoading: false,
            lastAuthCheck: Date.now(),
            error: null,
            authRequired: true,
          })
          return true
        } catch (error) {
          const status = getStatus(error)
          let errorMessage = 'Authentication failed'

          if (status === 400 || status === 401) {
            errorMessage = 'Invalid email or password. Please try again.'
          } else if (status === 403) {
            errorMessage = 'Access denied. Please check your credentials.'
          } else if (status && status >= 500) {
            errorMessage = 'Server error. Please try again later.'
          } else if (isNetworkError(error)) {
            errorMessage = 'Unable to connect to server. Please check if the API is running.'
          } else if (error instanceof Error) {
            errorMessage = `Authentication failed: ${error.message}`
          }

          set({
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false,
            user: null,
          })
          return false
        }
      },

      register: async (email: string, password: string, fullName?: string) => {
        set({ isLoading: true, error: null })
        try {
          const user = await authApi.register(email, password, fullName)
          set({
            isAuthenticated: true,
            user,
            isLoading: false,
            lastAuthCheck: Date.now(),
            error: null,
            authRequired: true,
          })
          return true
        } catch (error) {
          const status = getStatus(error)
          let errorMessage = 'Registration failed'

          if (status === 400) {
            errorMessage = 'Invalid input. Please check your information.'
          } else if (status === 409) {
            errorMessage = '该邮箱已被注册'
          } else if (status && status >= 500) {
            errorMessage = 'Server error. Please try again later.'
          } else if (isNetworkError(error)) {
            errorMessage = 'Unable to connect to server. Please check if the API is running.'
          } else if (error instanceof Error) {
            errorMessage = `Registration failed: ${error.message}`
          }

          set({
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false,
            user: null,
          })
          return false
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch (error) {
          console.error('Logout error:', error)
        }
        set({
          isAuthenticated: false,
          user: null,
          error: null,
          lastAuthCheck: null,
        })
      },

      checkAuth: async () => {
        const state = get()
        const { lastAuthCheck, isCheckingAuth, isAuthenticated, authRequired } = state

        if (authRequired === false) {
          return true
        }

        if (isCheckingAuth) {
          return isAuthenticated
        }

        const now = Date.now()
        if (isAuthenticated && lastAuthCheck && now - lastAuthCheck < 30000) {
          return true
        }

        set({ isCheckingAuth: true })

        try {
          const user = await authApi.getCurrentUser()
          set({
            isAuthenticated: true,
            user,
            lastAuthCheck: now,
            isCheckingAuth: false,
          })
          return true
        } catch (error) {
          set({
            isAuthenticated: false,
            user: null,
            lastAuthCheck: null,
            isCheckingAuth: false,
          })
          return false
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
