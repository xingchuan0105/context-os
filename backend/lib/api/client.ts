import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

// API client with configurable base URL
// Timeout set to 10 minutes to accommodate document processing operations
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 600000, // 600 seconds = 10 minutes
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor to add auth header
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      // Get token from localStorage
      const token = localStorage.getItem('auth_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    // Handle FormData vs JSON content types
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    } else if (config.method && ['post', 'put', 'patch'].includes(config.method.toLowerCase())) {
      config.headers['Content-Type'] = 'application/json'
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_id')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
