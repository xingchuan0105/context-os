/**
 * useChatStreaming - SSE 流式响应处理
 */

import { useCallback, useRef, useState } from 'react'
import type { Citation } from '@/lib/types/chat'

interface UseChatStreamingOptions {
  sessionId: string
  onStreamComplete?: () => void
  onError?: (message: string) => void
}

interface UseChatStreamingReturn {
  streamContent: string
  streamCitations: Citation[]
  isLoading: boolean
  startStream: (message: string, selectedSourceIds: string[]) => Promise<void>
  abortStream: () => void
}

export function useChatStreaming({
  sessionId,
  onStreamComplete,
  onError,
}: UseChatStreamingOptions): UseChatStreamingReturn {
  const [streamContent, setStreamContent] = useState('')
  const [streamCitations, setStreamCitations] = useState<Citation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const didAbortRef = useRef(false)
  const doneRef = useRef(false)

  const startStream = useCallback(
    async (message: string, selectedSourceIds: string[]) => {
      if (!sessionId || isLoading) return

      setIsLoading(true)
      setStreamContent('')
      setStreamCitations([])
      didAbortRef.current = false
      doneRef.current = false

      // 创建 AbortController
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            selectedSourceIds,
          }),
          signal: abortControllerRef.current.signal,
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
              const event = JSON.parse(line.slice(6))

              switch (event.type) {
                case 'token':
                  setStreamContent((prev) => prev + (event.data?.content || ''))
                  break
                case 'citation':
                  setStreamCitations((prev) => [...prev, event.data])
                  break
                case 'done':
                  doneRef.current = true
                  onStreamComplete?.()
                  setStreamContent('')
                  setStreamCitations([])
                  setIsLoading(false)
                  break
                case 'error':
                  onError?.(event.data?.message || 'Unknown error')
                  setIsLoading(false)
                  break
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }

        if (!doneRef.current && !didAbortRef.current) {
          onStreamComplete?.()
          setStreamContent('')
          setStreamCitations([])
        }
        setIsLoading(false)
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          onError?.(error.message)
        }
        setIsLoading(false)
      }
    },
    [sessionId, isLoading, onStreamComplete, onError]
  )

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      didAbortRef.current = true
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
  }, [])

  return {
    streamContent,
    streamCitations,
    isLoading,
    startStream,
    abortStream,
  }
}
