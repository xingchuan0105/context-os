const CANDIDATE_HEADER_FIELDS = ['headers', 'defaultHeaders', 'requestHeaders'] as const

function normalizeHeaderKey(value: string): string | null {
  const key = value.trim()
  return key ? key : null
}

function normalizeHeaderValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function toHeaderRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const source = value as Record<string, unknown>
  const lowerKeyMap = new Map<string, string>()
  const headers: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(source)) {
    if (typeof rawKey !== 'string') continue

    const normalizedKey = normalizeHeaderKey(rawKey)
    const normalizedValue = normalizeHeaderValue(rawValue)
    if (!normalizedKey || !normalizedValue) continue

    const lowerKey = normalizedKey.toLowerCase()
    const existingKey = lowerKeyMap.get(lowerKey)

    if (existingKey && existingKey !== normalizedKey) {
      delete headers[existingKey]
    }

    lowerKeyMap.set(lowerKey, normalizedKey)
    headers[normalizedKey] = normalizedValue
  }

  return headers
}

export function mergeHeaders(...sources: Array<Record<string, string> | null | undefined>): Record<string, string> | undefined {
  const merged: Record<string, string> = {}

  for (const source of sources) {
    if (!source) continue
    for (const [key, value] of Object.entries(source)) {
      const normalizedKey = normalizeHeaderKey(key)
      const normalizedValue = normalizeHeaderValue(value)
      if (!normalizedKey || !normalizedValue) continue
      merged[normalizedKey] = normalizedValue
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

export function extractHeadersFromExtra(extra: Record<string, unknown> | null | undefined): Record<string, string> | undefined {
  if (!extra) return undefined

  let merged: Record<string, string> | undefined
  for (const field of CANDIDATE_HEADER_FIELDS) {
    const record = toHeaderRecord(extra[field])
    if (Object.keys(record).length === 0) continue
    merged = mergeHeaders(merged, record)
  }

  return merged
}
