/**
 * SSE (Server-Sent Events) 流构建工具
 * 用于在服务端创建流式响应
 */

/**
 * 引用源信息
 */
export interface CitationSource {
  docId: string
  docName: string
  chunkIndex?: number
  score?: number
}

export interface SSEEvent {
  type: 'token' | 'citation' | 'done' | 'error' | 'start' | 'user' | 'search'
  data?: unknown
}

/**
 * 创建 SSE 流响应
 */
export function createSSEStream(
  onSend: (send: (event: SSEEvent) => void) => Promise<void>
): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      try {
        await onSend(send)
      } catch (error) {
        send({
          type: 'error',
          data: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * 创建 SSE 响应头
 */
export function getSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
  }
}

/**
 * 创建完整的 SSE Response
 */
export function createSSEResponse(
  onSend: (send: (event: SSEEvent) => void) => Promise<void>
): Response {
  return new Response(createSSEStream(onSend), {
    headers: getSSEHeaders(),
  })
}

/**
 * 便捷的事件发送器
 */
export class SSESender {
  private encoder = new TextEncoder()
  private controller: ReadableStreamDefaultController<Uint8Array>
  private closed = false

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.controller = controller
  }

  send(event: SSEEvent): void {
    if (this.closed) return
    const data = `data: ${JSON.stringify(event)}\n\n`
    try {
      this.controller.enqueue(this.encoder.encode(data))
    } catch (error) {
      if (this.isControllerClosed(error)) {
        this.closed = true
        return
      }
      throw error
    }
  }

  token(content: string): void {
    this.send({ type: 'token', data: { content } })
  }

  citation(index: number, content: string, source: CitationSource): void {
    this.send({
      type: 'citation',
      data: { index, content, source },
    })
  }

  start(data?: Record<string, unknown>): void {
    this.send({ type: 'start', data })
  }

  done(data?: Record<string, unknown>): void {
    this.send({ type: 'done', data })
  }

  error(message: string): void {
    this.send({ type: 'error', data: { message } })
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    try {
      this.controller.close()
    } catch (error) {
      if (!this.isControllerClosed(error)) {
        throw error
      }
    }
  }

  private isControllerClosed(error: unknown): boolean {
    return error instanceof Error && /controller is already closed|invalid state/i.test(error.message)
  }
}

/**
 * 使用 SSESender 创建流
 */
export function createSSEStreamWithSender(
  callback: (sender: SSESender) => Promise<void>
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const sender = new SSESender(controller)
      try {
        await callback(sender)
      } catch (error) {
        sender.error(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        sender.close()
      }
    },
  })
}
