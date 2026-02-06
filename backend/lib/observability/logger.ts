type Primitive = string | number | boolean | null | undefined

const SENSITIVE_KEYS = new Set([
  'authorization',
  'api_key',
  'apikey',
  'token',
  'secret',
  'password',
  'key',
  'cookie',
  'set-cookie',
  'session',
])

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]+/gi, 'sk-[REDACTED]')
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (typeof value === 'object') return sanitizeObject(value as Record<string, unknown>)
  return value
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = sanitizeValue(value)
    }
  }
  return result
}

const LOG_SINK_URL = process.env.LOG_SINK_URL || ''
const LOG_SINK_TIMEOUT_MS = parseInt(process.env.LOG_SINK_TIMEOUT_MS || '3000', 10)
const LOG_SINK_LEVEL = (process.env.LOG_SINK_LEVEL || 'error').toLowerCase()

const LEVEL_ORDER: Record<string, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function shouldSend(level: string): boolean {
  const current = LEVEL_ORDER[level] || 0
  const threshold = LEVEL_ORDER[LOG_SINK_LEVEL] || 40
  return current >= threshold
}

async function sendToSink(payload: Record<string, unknown>): Promise<void> {
  if (!LOG_SINK_URL) return
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOG_SINK_TIMEOUT_MS)
  try {
    await fetch(LOG_SINK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch {
    // swallow sink errors
  } finally {
    clearTimeout(timer)
  }
}

export function logInfo(event: string, data: Record<string, unknown> = {}): void {
  const payload = {
    level: 'info',
    event,
    ...sanitizeObject(data),
    ts: new Date().toISOString(),
  }
  console.log(JSON.stringify(payload))
  if (LOG_SINK_URL && shouldSend('info')) {
    void sendToSink(payload)
  }
}

export function logError(
  event: string,
  error: unknown,
  data: Record<string, unknown> = {}
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  const payload = {
    level: 'error',
    event,
    message: err.message,
    stack: err.stack,
    ...sanitizeObject(data),
    ts: new Date().toISOString(),
  }
  console.error(JSON.stringify(payload))
  if (LOG_SINK_URL && shouldSend('error')) {
    void sendToSink(payload)
  }
}
