import { NextRequest } from 'next/server'
import { APIError, ValidationError, success, withErrorHandler } from '@/lib/api/errors'
import { getAdminMetricsOverview, type AdminMetricsOverview } from '@/lib/admin/metrics'
import { requireAdminUser } from '@/lib/auth/admin'
import { checkRateLimit, getClientKey } from '@/lib/api/limits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_DAYS = 30
const DEFAULT_TOP_USERS = 10
const MIN_DAYS = 1
const MAX_DAYS = 90
const MIN_TOP_USERS = 5
const MAX_TOP_USERS = 50

type MetricsCacheEntry = {
  key: string
  data: AdminMetricsOverview
  expiresAt: number
}

let overviewCache: MetricsCacheEntry | null = null

function getNonNegativeIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

const ADMIN_METRICS_RATE_LIMIT_MAX = getNonNegativeIntegerEnv('ADMIN_METRICS_RATE_LIMIT_MAX', 120)
const ADMIN_METRICS_RATE_LIMIT_WINDOW_MS = getPositiveIntegerEnv(
  'ADMIN_METRICS_RATE_LIMIT_WINDOW_MS',
  60_000,
)
const ADMIN_METRICS_CACHE_TTL_SECONDS = getPositiveIntegerEnv('ADMIN_METRICS_CACHE_TTL_SECONDS', 60)

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

function buildCacheKey(days: number, topUsers: number): string {
  return `${days}:${topUsers}`
}

function applyCacheMeta(
  metrics: AdminMetricsOverview,
  cacheState: { hit: boolean; stale: boolean; ttlSeconds: number },
): AdminMetricsOverview {
  return {
    ...metrics,
    meta: {
      ...metrics.meta,
      cache: {
        hit: cacheState.hit,
        stale: cacheState.stale,
        ttlSeconds: Math.max(0, cacheState.ttlSeconds),
      },
    },
  }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAdminUser()

  if (ADMIN_METRICS_RATE_LIMIT_MAX > 0) {
    const key = `admin-metrics:${user.id}:${getClientKey(req)}`
    const rate = await checkRateLimit(key, ADMIN_METRICS_RATE_LIMIT_MAX, ADMIN_METRICS_RATE_LIMIT_WINDOW_MS)
    if (!rate.allowed) {
      throw new APIError(429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', {
        limit: ADMIN_METRICS_RATE_LIMIT_MAX,
        windowMs: ADMIN_METRICS_RATE_LIMIT_WINDOW_MS,
        resetAt: new Date(rate.resetAt).toISOString(),
      })
    }
  }

  const days = parseBoundedInteger(req, 'days', DEFAULT_DAYS, MIN_DAYS, MAX_DAYS)
  const topUsers = parseBoundedInteger(req, 'topUsers', DEFAULT_TOP_USERS, MIN_TOP_USERS, MAX_TOP_USERS)
  const forceRefresh = parseBooleanParam(req, 'refresh')
  const cacheKey = buildCacheKey(days, topUsers)

  const cached = overviewCache
  if (
    !forceRefresh &&
    cached &&
    cached.key === cacheKey &&
    cached.expiresAt > Date.now()
  ) {
    const ttlSeconds = Math.ceil((cached.expiresAt - Date.now()) / 1000)
    return success(
      applyCacheMeta(cached.data, {
        hit: true,
        stale: false,
        ttlSeconds,
      })
    )
  }

  try {
    const metrics = getAdminMetricsOverview({
      days,
      topUsersLimit: topUsers,
    })

    const ttlSeconds = Math.max(1, ADMIN_METRICS_CACHE_TTL_SECONDS)
    overviewCache = {
      key: cacheKey,
      data: metrics,
      expiresAt: Date.now() + ttlSeconds * 1000,
    }

    return success(
      applyCacheMeta(metrics, {
        hit: false,
        stale: false,
        ttlSeconds,
      })
    )
  } catch (error) {
    if (cached && cached.key === cacheKey) {
      return success(
        applyCacheMeta(cached.data, {
          hit: true,
          stale: true,
          ttlSeconds: 0,
        })
      )
    }
    throw error
  }
})
