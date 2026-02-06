/**
 * useChatScroll - 自动滚动逻辑
 */

import { useEffect, useRef } from 'react'

interface UseChatScrollOptions {
  messages: unknown[]
  streamContent: string
  autoScroll?: boolean
}

export function useChatScroll({
  messages,
  streamContent,
  autoScroll = true,
}: UseChatScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streamContent, autoScroll])

  return scrollRef
}
