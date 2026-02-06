/**
 * API Client Unit Tests
 *
 * Tests for the API client and its methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { APIClient, APIClientError, createAPIClient, isAPIClientError } from '@/lib/api/client'

// Mock fetch globally
global.fetch = vi.fn()

describe('APIClient', () => {
  let client: APIClient

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.mocked(global.fetch).mockReset()
    // Create new client instance
    client = new APIClient({
      baseURL: 'http://localhost:3000/api',
      timeout: 5000,
    })
  })

  describe('Construction', () => {
    it('should create client with default config', () => {
      const defaultClient = new APIClient()
      expect(defaultClient).toBeInstanceOf(APIClient)
    })

    it('should create client with custom config', () => {
      const customClient = new APIClient({
        baseURL: '/custom-api',
        timeout: 10000,
        headers: {
          'X-Custom-Header': 'value',
        },
      })
      expect(customClient).toBeInstanceOf(APIClient)
    })

    it('should create client with getToken callback', () => {
      const getToken = vi.fn().mockResolvedValue('token-123')
      const authClient = new APIClient({ getToken })
      expect(authClient).toBeInstanceOf(APIClient)
    })
  })

  describe('GET Requests', () => {
    it('should make successful GET request', async () => {
      const mockData = { id: '1', name: 'Test' }
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockData,
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      const result = await client.get('/test')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result).toEqual(mockData)
    })

    it('should include query parameters', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      await client.get('/test', { kbId: 'kb-123', status: 'active' })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test?kbId=kb-123&status=active',
        expect.any(Object)
      )
    })

    it('should handle undefined query parameters', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      await client.get('/test', { kbId: 'kb-123', search: undefined })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test?kbId=kb-123',
        expect.any(Object)
      )
    })

    it('should throw error on failed response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found',
            timestamp: new Date().toISOString(),
          },
        }),
      } as Response)

      await expect(client.get('/test')).rejects.toThrow(APIClientError)
    })
  })

  describe('POST Requests', () => {
    it('should make successful POST request with JSON', async () => {
      const mockData = { id: '1', name: 'Created' }
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockData,
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      const result = await client.post('/test', { name: 'Test' })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
        })
      )
      expect(result).toEqual(mockData)
    })

    it('should make POST request with FormData', async () => {
      const mockData = { id: '1' }
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockData,
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      const formData = new FormData()
      formData.append('file', new Blob(['test']), 'test.txt')

      await client.post('/test', formData)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          method: 'POST',
          body: formData,
        })
      )
    })
  })

  describe('PUT Requests', () => {
    it('should make successful PUT request', async () => {
      const mockData = { id: '1', name: 'Updated' }
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockData,
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      const result = await client.put('/test/1', { name: 'Updated' })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        })
      )
      expect(result).toEqual(mockData)
    })
  })

  describe('PATCH Requests', () => {
    it('should make successful PATCH request', async () => {
      const mockData = { id: '1', name: 'Patched' }
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockData,
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      const result = await client.patch('/test/1', { name: 'Patched' })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Patched' }),
        })
      )
      expect(result).toEqual(mockData)
    })
  })

  describe('DELETE Requests', () => {
    it('should make successful DELETE request', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: null,
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      await client.delete('/test/1')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('Authentication', () => {
    it('should add authorization header with token', async () => {
      const getToken = vi.fn().mockResolvedValue('token-123')
      const authClient = new APIClient({ getToken })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {},
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      await authClient.get('/test')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token-123',
          }),
        })
      )
    })

    it('should not add authorization header if token is empty', async () => {
      const getToken = vi.fn().mockResolvedValue('')
      const authClient = new APIClient({ getToken })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {},
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      await authClient.get('/test')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      )
    })
  })

  describe('Request Interceptor', () => {
    it('should apply request interceptor', async () => {
      const onRequest = vi.fn().mockImplementation(async (config) => ({
        ...config,
        headers: {
          ...config.headers,
          'X-Intercepted': 'true',
        },
      }))

      const interceptedClient = new APIClient({ onRequest })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {},
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      await interceptedClient.get('/test')

      expect(onRequest).toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Intercepted': 'true',
          }),
        })
      )
    })
  })

  describe('Response Interceptor', () => {
    it('should apply response interceptor', async () => {
      const onResponse = vi.fn().mockImplementation(async (data) => ({
        ...data,
        intercepted: true,
      }))

      const interceptedClient = new APIClient({ onResponse })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { original: true },
          timestamp: new Date().toISOString(),
        }),
      } as Response)

      const result = await interceptedClient.get('/test')

      expect(onResponse).toHaveBeenCalled()
      expect(result).toEqual({ original: true, intercepted: true })
    })
  })

  describe('Error Handling', () => {
    it('should handle API error responses', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: { field: 'email' },
            timestamp: new Date().toISOString(),
          },
        }),
      } as Response)

      await expect(client.get('/test')).rejects.toThrow(APIClientError)

      try {
        await client.get('/test')
      } catch (error) {
        if (error instanceof APIClientError) {
          expect(error.code).toBe('VALIDATION_ERROR')
          expect(error.statusCode).toBe(400)
          expect(error.message).toBe('Invalid input')
          expect(error.details).toEqual({ field: 'email' })
        }
      }
    })

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )

      await expect(client.get('/test')).rejects.toThrow('Network error')

      try {
        await client.get('/test')
      } catch (error) {
        if (error instanceof APIClientError) {
          expect(error.code).toBe('NETWORK_ERROR')
        }
      }
    })

    it('should handle timeout errors', async () => {
      const timeoutClient = new APIClient({ timeout: 100 })

      vi.mocked(global.fetch).mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 200)
        )
      )

      await expect(timeoutClient.get('/test')).rejects.toThrow('Request timeout')

      try {
        await timeoutClient.get('/test')
      } catch (error) {
        if (error instanceof APIClientError) {
          expect(error.code).toBe('TIMEOUT_ERROR')
        }
      }
    })
  })

  describe('Error Callback', () => {
    it('should call error callback on API error', async () => {
      const onError = vi.fn()
      const errorClient = new APIClient({ onError })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            timestamp: new Date().toISOString(),
          },
        }),
      } as Response)

      try {
        await errorClient.get('/test')
      } catch (error) {
        // Ignore error
      }

      expect(onError).toHaveBeenCalled()
    })
  })
})

describe('APIClientError', () => {
  it('should create error with all properties', () => {
    const error = new APIClientError(
      'TEST_ERROR',
      400,
      'Test error message',
      { field: 'test' }
    )

    expect(error.code).toBe('TEST_ERROR')
    expect(error.statusCode).toBe(400)
    expect(error.message).toBe('Test error message')
    expect(error.details).toEqual({ field: 'test' })
    expect(error.name).toBe('APIClientError')
  })
})

describe('createAPIClient', () => {
  it('should create APIClient instance', () => {
    const client = createAPIClient({
      baseURL: '/api',
      timeout: 10000,
    })

    expect(client).toBeInstanceOf(APIClient)
  })
})

describe('isAPIClientError', () => {
  it('should return true for APIClientError', () => {
    const error = new APIClientError('TEST', 400, 'Test')
    expect(isAPIClientError(error)).toBe(true)
  })

  it('should return false for other errors', () => {
    const error = new Error('Regular error')
    expect(isAPIClientError(error)).toBe(false)
  })

  it('should return false for non-errors', () => {
    expect(isAPIClientError('string')).toBe(false)
    expect(isAPIClientError(null)).toBe(false)
    expect(isAPIClientError(undefined)).toBe(false)
  })
})
