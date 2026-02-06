'use client'

/**
 * SSE 客户端 Hook
 * 用于接收和处理服务端发送的流式数据
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export interface SSEEvent {
  type: 'token' | 'citation' | 'done' | 'error' | 'start'
  data?: any
  timestamp?: number
}

export interface SSEOptions {
  onToken?: (content: string) => void
  onCitation?: (citation: any) => void
  onDone?: (data?: any) => void
  onError?: (error: string) => void
  onStart?: (data?: any) => void
}

export interface UseSSEStreamResult {
  isConnected: boolean
  error: string | null
  sendMessage: (message: string, extraData?: Record<string, any>) => void
  abort: () => void
}

/**
 * SSE 流式 Hook
 */
export function useSSEStream(
  url: string,
  options: SSEOptions = {}
): UseSSEStreamResult {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (message: string, extraData: Record<string, any> = {}) => {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController()
      setError(null)
      setIsConnected(true)

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message, ...extraData }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        if (!reader) {
          throw new Error('No response body')
        }

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          // 解码并添加到缓冲区
          buffer += decoder.decode(value, { stream: true })

          // 处理缓冲区中的完整消息
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || '' // 保留最后一个不完整的消息

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue

            try {
              const jsonStr = line.slice(6) // 移除 "data: " 前缀
              const event: SSEEvent = JSON.parse(jsonStr)

              // 处理不同类型的事件
              switch (event.type) {
                case 'token':
                  options.onToken?.(event.data?.content || '')
                  break
                case 'citation':
                  options.onCitation?.(event.data)
                  break
                case 'done':
                  options.onDone?.(event.data)
                  break
                case 'error':
                  const errorMsg = event.data?.message || event.data || 'Unknown error'
                  setError(errorMsg)
                  options.onError?.(errorMsg)
                  break
                case 'start':
                  options.onStart?.(event.data)
                  break
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError)
            }
          }
        }

        setIsConnected(false)
      } catch (err) {
        setIsConnected(false)
        if (err instanceof Error && err.name !== 'AbortError') {
          const errorMsg = err.message
          setError(errorMsg)
          options.onError?.(errorMsg)
        }
      }
    },
    [url, options]
  )

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsConnected(false)
  }, [])

  // 清理函数
  useEffect(() => {
    return () => {
      abort()
    }
  }, [abort])

  return {
    isConnected,
    error,
    sendMessage,
    abort,
  }
}

/**
 * 简化版 SSE Hook，用于聊天场景
 */
export function useSSEChat(apiUrl: string) {
  const [content, setContent] = useState('')
  const [citations, setCitations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (message: string, extraData?: Record<string, any>) => {
      // 取消之前的请求
      if (abortRef.current) {
        abortRef.current.abort()
      }

      abortRef.current = new AbortController()
      setContent('')
      setCitations([])
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, ...extraData }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        if (!reader) throw new Error('No response body')

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue

            try {
              const event: SSEEvent = JSON.parse(line.slice(6))

              switch (event.type) {
                case 'token':
                  setContent((prev) => prev + (event.data?.content || ''))
                  break
                case 'citation':
                  setCitations((prev) => [...prev, event.data])
                  break
                case 'done':
                  setIsLoading(false)
                  break
                case 'error':
                  setError(event.data?.message || 'Unknown error')
                  setIsLoading(false)
                  break
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      } catch (err) {
        setIsLoading(false)
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      }
    },
    [apiUrl]
  )

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsLoading(false)
  }, [])

  // 清理
  useEffect(() => {
    return () => abort()
  }, [abort])

  return {
    content,
    citations,
    isLoading,
    error,
    sendMessage,
    abort,
  }
}
