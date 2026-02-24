import { NextRequest } from 'next/server'
import { success, ValidationError, withErrorHandler } from '@/lib/api/errors'
import { requireAdminUser } from '@/lib/auth/admin'
import {
  getAdminLiteLLMUsageSummary,
  type AdminLiteLLMUsageSummary,
} from '@/lib/admin/litellm-usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_DAYS = 30
const MIN_DAYS = 1
const MAX_DAYS = 90

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

const ADMIN_LITELLM_USAGE_CACHE_TTL_SECONDS = getPositiveIntegerEnv(
  'ADMIN_LITELLM_USAGE_CACHE_TTL_SECONDS',
  60,
)

type UsageCacheEntry = {
  key: string
  data: AdminLiteLLMUsageSummary
  expiresAt: number
}

let usageCache: UsageCacheEntry | null = null

function parseBoundedInteger(
  req: NextRequest,
  key: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const raw = req.nextUrl.searchParams.get(key)
  if (!raw || raw.trim().length === 0) {
    return defaultValue
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${key} must be an integer`, {
      key,
      value: raw,
      min,
      max,
    })
  }

  return Math.max(min, Math.min(max, parsed))
}

function parseBooleanParam(req: NextRequest, key: string): boolean {
  const raw = req.nextUrl.searchParams.get(key)
  if (!raw) return false
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function buildCacheKey(days: number): string {
  return `${days}`
}

function withCacheMeta(
  summary: AdminLiteLLMUsageSummary,
  cacheState: { hit: boolean; stale: boolean; ttlSeconds: number },
  queryDurationMs: number,
) {
  return {
    ...summary,
    meta: {
      queryDurationMs,
      cache: {
        hit: cacheState.hit,
        stale: cacheState.stale,
        ttlSeconds: Math.max(0, cacheState.ttlSeconds),
      },
    },
  }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdminUser()

  const days = parseBoundedInteger(req, 'days', DEFAULT_DAYS, MIN_DAYS, MAX_DAYS)
  const forceRefresh = parseBooleanParam(req, 'refresh')
  const cacheKey = buildCacheKey(days)

  const cached = usageCache
  if (!forceRefresh && cached && cached.key === cacheKey && cached.expiresAt > Date.now()) {
    const ttlSeconds = Math.ceil((cached.expiresAt - Date.now()) / 1000)
    return success(
      withCacheMeta(
        cached.data,
        {
          hit: true,
          stale: false,
          ttlSeconds,
        },
        0,
      )
    )
  }

  const startedAt = Date.now()

  try {
    const summary = await getAdminLiteLLMUsageSummary({ days })
    const ttlSeconds = Math.max(1, ADMIN_LITELLM_USAGE_CACHE_TTL_SECONDS)

    usageCache = {
      key: cacheKey,
      data: summary,
      expiresAt: Date.now() + ttlSeconds * 1000,
    }

    return success(
      withCacheMeta(
        summary,
        {
          hit: false,
          stale: false,
          ttlSeconds,
        },
        Date.now() - startedAt,
      )
    )
  } catch (error) {
    if (cached && cached.key === cacheKey) {
      return success(
        withCacheMeta(
          cached.data,
          {
            hit: true,
            stale: true,
            ttlSeconds: 0,
          },
          Date.now() - startedAt,
        )
      )
    }
    throw error
  }
})
