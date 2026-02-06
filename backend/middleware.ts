import { NextResponse, type NextRequest } from 'next/server'

function parseTraceparent(traceparent: string | null): string | null {
  if (!traceparent) return null
  const parts = traceparent.split('-')
  if (parts.length < 4) return null
  const traceId = parts[1]
  return traceId && traceId.length === 32 ? traceId : null
}

function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function generateSpanId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

export function middleware(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID()
  const existingTraceparent = req.headers.get('traceparent')
  const traceIdFromParent = parseTraceparent(existingTraceparent)
  const traceId = req.headers.get('x-trace-id') || traceIdFromParent || generateTraceId()
  const traceparent = existingTraceparent || `00-${traceId}-${generateSpanId()}-01`
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-request-id', requestId)
  requestHeaders.set('x-trace-id', traceId)
  requestHeaders.set('traceparent', traceparent)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set('x-request-id', requestId)
  response.headers.set('x-trace-id', traceId)
  response.headers.set('traceparent', traceparent)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
