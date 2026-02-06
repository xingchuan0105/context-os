/**
 * API Client
 *
 * Type-safe API client for frontend consumption
 * Handles authentication, error handling, and request/response transformation
 */

import type {
  APIResponse,
  APIError,
  APIClientConfig,
  RequestOptions,
  HTTPStatusCode,
} from '../types'

// ==================== Error Classes ====================

/**
 * API request error (thrown when API returns an error response)
 */
export class APIClientError extends Error {
  constructor(
    public code: string,
    public statusCode: HTTPStatusCode,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'APIClientError'
  }
}

// ==================== Client Class ====================

/**
 * API Client for making HTTP requests to the Context-OS backend
 *
 * @example
 * const client = new APIClient({
 *   baseURL: '/api',
 *   getToken: () => localStorage.getItem('token') || ''
 * })
 *
 * const documents = await client.get('/documents', { kbId: 'xxx' })
 */
export class APIClient {
  private baseURL: string
  private defaultTimeout: number
  private defaultHeaders: Record<string, string>
  private getToken?: () => string | Promise<string>
  private onRequest?: (config: RequestInit) => RequestInit | Promise<RequestInit>
  private onResponse?: <T>(response: T) => T | Promise<T>
  private onError?: (error: APIError) => void | Promise<void>

  constructor(config: APIClientConfig = {}) {
    this.baseURL = config.baseURL || '/api'
    this.defaultTimeout = config.timeout || 30000
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    }
    this.getToken = config.getToken
    this.onRequest = config.onRequest
    this.onResponse = config.onResponse
    this.onError = config.onError
  }

  /**
   * Make a GET request
   *
   * @param endpoint - API endpoint path (e.g., '/documents')
   * @param params - Query parameters
   * @param options - Request options
   * @returns Promise<T>
   *
   * @example
   * const documents = await client.get('/documents', { kbId: 'xxx' })
   */
  async get<T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildURL(endpoint, params)
    return this.request<T>('GET', url, undefined, options)
  }

  /**
   * Make a POST request
   *
   * @param endpoint - API endpoint path
   * @param data - Request body
   * @param options - Request options
   * @returns Promise<T>
   *
   * @example
   * const result = await client.post('/documents', { file, kbId: 'xxx' }, {
   *   headers: { 'Content-Type': 'multipart/form-data' }
   * })
   */
  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildURL(endpoint)
    return this.request<T>('POST', url, data, options)
  }

  /**
   * Make a PUT request
   *
   * @param endpoint - API endpoint path
   * @param data - Request body
   * @param options - Request options
   * @returns Promise<T>
   */
  async put<T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildURL(endpoint)
    return this.request<T>('PUT', url, data, options)
  }

  /**
   * Make a PATCH request
   *
   * @param endpoint - API endpoint path
   * @param data - Request body
   * @param options - Request options
   * @returns Promise<T>
   */
  async patch<T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildURL(endpoint)
    return this.request<T>('PATCH', url, data, options)
  }

  /**
   * Make a DELETE request
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters
   * @param options - Request options
   * @returns Promise<T>
   */
  async delete<T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildURL(endpoint, params)
    return this.request<T>('DELETE', url, undefined, options)
  }

  /**
   * Core request method
   *
   * @param method - HTTP method
   * @param url - Full URL
   * @param data - Request body
   * @param options - Request options
   * @returns Promise<T>
   */
  private async request<T>(
    method: string,
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const timeout = options?.timeout || this.defaultTimeout

    // Build request config
    const config: RequestInit = {
      method,
      headers: await this.buildHeaders(options?.headers),
      signal: options?.signal || AbortSignal.timeout(timeout),
    }

    // Add body for non-GET requests
    if (data !== undefined && method !== 'GET') {
      if (data instanceof FormData) {
        config.body = data as FormData
        // Remove Content-Type to let browser set it with boundary
        delete (config.headers as Record<string, string>)['Content-Type']
      } else {
        config.body = JSON.stringify(data)
      }
    }

    // Apply request interceptor
    const finalConfig = this.onRequest
      ? await this.onRequest(config)
      : config

    try {
      // Make request
      const response = await fetch(url, finalConfig)

      // Parse response
      const responseData: APIResponse<T> = await response.json()

      // Handle error responses
      if (!responseData.success || !response.ok) {
        if (responseData.error) {
          // Trigger error callback
          if (this.onError) {
            await this.onError(responseData.error)
          }

          // Throw typed error
          throw new APIClientError(
            responseData.error.code,
            response.status as HTTPStatusCode,
            responseData.error.message,
            responseData.error.details
          )
        }

        // If no error structure but not OK, throw generic error
        throw new APIClientError(
          'UNKNOWN_ERROR',
          response.status as HTTPStatusCode,
          response.statusText || 'Unknown error occurred'
        )
      }

      // Extract data
      const result = responseData.data as T

      // Apply response interceptor
      return this.onResponse ? await this.onResponse(result) : result

    } catch (error) {
      // Re-throw APIClientError as-is
      if (error instanceof APIClientError) {
        throw error
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new APIClientError(
          'NETWORK_ERROR',
          503 as any,
          'Network error: Failed to connect to the server'
        )
      }

      // Handle timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new APIClientError(
          'TIMEOUT_ERROR',
          504 as any,
          `Request timeout after ${timeout}ms`
        )
      }

      // Unknown error
      throw new APIClientError(
        'UNKNOWN_ERROR',
        500 as any,
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }

  /**
   * Build full URL with query parameters
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters
   * @returns Full URL
   */
  private buildURL(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    // Remove leading slash from endpoint if present
    const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
    let url = `${this.baseURL}/${path}`

    // Add query parameters
    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value))
        }
      }
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    return url
  }

  /**
   * Build request headers
   *
   * @param extraHeaders - Additional headers
   * @returns Headers object
   */
  private async buildHeaders(
    extraHeaders?: Record<string, string>
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...extraHeaders,
    }

    // Add authentication token
    if (this.getToken) {
      const token = await this.getToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    return headers
  }
}

// ==================== Default Client Instance ====================

/**
 * Default API client instance
 *
 * @example
 * import { apiClient } from '@/lib/api/client'
 * const documents = await apiClient.get('/documents', { kbId: 'xxx' })
 */
export const apiClient = new APIClient({
  baseURL: typeof window !== 'undefined'
    ? window.location.origin + '/api'
    : process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL + '/api'
    : 'http://localhost:3000/api',
  timeout: 30000,
})

// ==================== Utility Functions ====================

/**
 * Create a new API client with custom configuration
 *
 * @param config - Client configuration
 * @returns Configured APIClient instance
 *
 * @example
 * const client = createAPIClient({
 *   baseURL: '/api',
 *   getToken: () => localStorage.getItem('token') || ''
 * })
 */
export function createAPIClient(config: APIClientConfig): APIClient {
  return new APIClient(config)
}

/**
 * Check if an error is an APIClientError
 *
 * @param error - Error to check
 * @returns True if error is APIClientError
 *
 * @example
 * try {
 *   await apiClient.get('/documents')
 * } catch (error) {
 *   if (isAPIClientError(error)) {
 *     console.error(`API Error: ${error.code} - ${error.message}`)
 *   }
 * }
 */
export function isAPIClientError(error: unknown): error is APIClientError {
  return error instanceof APIClientError
}
