import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { logError, logInfo } from '../observability/logger'
import { incrementCounter, recordTiming } from '../observability/metrics'
import { validateEnv } from '../config/env'

export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'APIError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends APIError {
  constructor(message: string = 'Forbidden') {
    super(403, 'FORBIDDEN', message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends APIError {
  constructor(message: string, details?: unknown) {
    super(409, 'CONFLICT', message, details)
    this.name = 'ConflictError'
  }
}

export class InternalServerError extends APIError {
  constructor(message: string = 'Internal server error', details?: unknown) {
    super(500, 'INTERNAL_ERROR', message, details)
    this.name = 'InternalServerError'
  }
}

export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
    timestamp: string
    requestId?: string
    traceId?: string
  }
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export function getRequestId(req?: NextRequest): string {
  return req?.headers.get('x-request-id') || generateRequestId()
}

export function getTraceId(req?: NextRequest): string | undefined {
  return req?.headers.get('x-trace-id') || undefined
}

function attachRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId)
  return response
}

export function handleAPIError(error: unknown, requestId?: string, traceId?: string): NextResponse {
  logError('api_error', error, { requestId, traceId })

  if (error instanceof APIError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
        requestId,
        traceId,
      },
    }
    return NextResponse.json(response, { status: error.statusCode })
  }

  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: error.issues,
        timestamp: new Date().toISOString(),
        requestId,
        traceId,
      },
    }
    return NextResponse.json(response, { status: 400 })
  }

  if (error instanceof Error) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
        requestId,
        traceId,
      },
    }

    if (process.env.NODE_ENV === 'development') {
      response.error.details = {
        stack: error.stack,
        name: error.name,
      }
    }

    return NextResponse.json(response, { status: 500 })
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error',
      timestamp: new Date().toISOString(),
      requestId,
      traceId,
    },
  }

  return NextResponse.json(response, { status: 500 })
}

export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    const req = args[0] as NextRequest | undefined
    const requestId = getRequestId(req)
    const traceId = getTraceId(req)
    const method = req?.method || 'UNKNOWN'
    const path = req?.nextUrl?.pathname || req?.url || 'unknown'
    const start = Date.now()

    try {
      validateEnv()
      const response = await handler(...args)
      const durationMs = Date.now() - start
      recordTiming('api_request', durationMs, { method, path, status: response.status })
      logInfo('request', { requestId, traceId, method, path, status: response.status, durationMs })
      return attachRequestId(response, requestId)
    } catch (error) {
      const durationMs = Date.now() - start
      incrementCounter('api_error')
      recordTiming('api_request', durationMs, { method, path, status: 500 })
      logInfo('request', { requestId, traceId, method, path, status: 500, durationMs })
      const response = handleAPIError(error, requestId, traceId)
      return attachRequestId(response, requestId)
    }
  }
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return handleAPIError(new ValidationError(message, details))
}

export function unauthorized(message?: string): NextResponse {
  return handleAPIError(new UnauthorizedError(message))
}

export function forbidden(message?: string): NextResponse {
  return handleAPIError(new ForbiddenError(message))
}

export function notFound(resource: string): NextResponse {
  return handleAPIError(new NotFoundError(resource))
}

export function conflict(message: string, details?: unknown): NextResponse {
  return handleAPIError(new ConflictError(message, details))
}

export function internalServerError(message?: string, details?: unknown): NextResponse {
  return handleAPIError(new InternalServerError(message, details))
}

export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  timestamp: string
}

export function success<T>(data: T, status: number = 200): NextResponse {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  }
  return NextResponse.json(response, { status })
}

export interface PaginatedResponse<T> {
  success: true
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  timestamp: string
}

export function paginated<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): NextResponse {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    timestamp: new Date().toISOString(),
  }
  return NextResponse.json(response)
}
