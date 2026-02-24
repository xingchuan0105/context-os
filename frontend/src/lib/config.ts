/**
 * Runtime configuration for the frontend.
 * This allows the same Docker image to work in different environments.
 */

import { AppConfig, BackendConfigResponse } from '@/lib/types/config'

// Debug logging (仅开发环境)
const isDev = process.env.NODE_ENV === 'development'
const debugLog = (...args: unknown[]) => {
  if (isDev) {
    console.log(...args)
  }
}

interface RuntimeConfigResponse {
  apiUrl?: string
  version?: string
  latestVersion?: string | null
  hasUpdate?: boolean
  dbStatus?: "online" | "offline"
  backendReachable?: boolean
}

// Build timestamp for debugging - set at build time
const BUILD_TIME = new Date().toISOString()

let config: AppConfig | null = null
let configPromise: Promise<AppConfig> | null = null

function getFrontendOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'
}

function normalizeApiUrl(apiUrl: string): string {
  if (typeof window === 'undefined') {
    return apiUrl
  }

  try {
    const parsedUrl = new URL(apiUrl)
    if (parsedUrl.hostname === '0.0.0.0' || parsedUrl.hostname === '::' || parsedUrl.hostname === '[::]') {
      return window.location.origin
    }
    return parsedUrl.origin
  } catch {
    return apiUrl
  }
}

function buildFallbackConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    apiUrl: getFrontendOrigin(),
    version: 'unknown',
    buildTime: BUILD_TIME,
    latestVersion: null,
    hasUpdate: false,
    backendReachable: false,
    ...overrides,
  }
}

/**
 * Get the API URL to use for requests.
 *
 * Priority:
 * 1. Runtime config from API server (/config endpoint)
 * 2. Environment variable (NEXT_PUBLIC_API_URL)
 * 3. Default fallback (http://localhost:3002)
 */
export async function getApiUrl(): Promise<string> {
  // If we already have config, return it
  if (config) {
    return config.apiUrl
  }

  // If we're already fetching, wait for that
  if (configPromise) {
    try {
      const cfg = await configPromise
      return cfg.apiUrl
    } catch (error) {
      configPromise = null
      throw error
    }
  }

  // Start fetching config
  configPromise = fetchConfig()
  try {
    const cfg = await configPromise
    return cfg.apiUrl
  } catch (error) {
    configPromise = null
    throw error
  }
}

/**
 * Get the full configuration.
 */
export async function getConfig(): Promise<AppConfig> {
  if (config) {
    return config
  }

  if (configPromise) {
    try {
      return await configPromise
    } catch (error) {
      configPromise = null
      throw error
    }
  }

  configPromise = fetchConfig()
  try {
    return await configPromise
  } catch (error) {
    configPromise = null
    throw error
  }
}

/**
 * Fetch configuration from the API or use defaults.
 */
async function fetchConfig(): Promise<AppConfig> {
  debugLog('🔧 [Config] Starting configuration detection...')
  debugLog('🔧 [Config] Build time:', BUILD_TIME)

  // STEP 1: Try to get runtime config from Next.js server-side endpoint
  // This allows API_URL to be set at runtime (not baked into build)
  // Note: Endpoint is at /config (not /api/config) to avoid reverse proxy conflicts
  let runtimeApiUrl: string | null = null
  try {
    debugLog('🔧 [Config] Attempting to fetch runtime config from /config endpoint...')
    const runtimeResponse = await fetch('/config', {
      cache: 'no-store',
    })
    if (runtimeResponse.ok) {
      const runtimeData = await runtimeResponse.json() as RuntimeConfigResponse
      runtimeApiUrl = runtimeData.apiUrl ? normalizeApiUrl(runtimeData.apiUrl) : null
      debugLog('? [Config] Runtime API URL from server:', runtimeApiUrl)
      if (runtimeApiUrl) {
        config = {
          apiUrl: runtimeApiUrl,
          version: runtimeData.version || 'unknown',
          buildTime: BUILD_TIME,
          latestVersion: runtimeData.latestVersion ?? null,
          hasUpdate: runtimeData.hasUpdate ?? false,
          dbStatus: runtimeData.dbStatus,
          backendReachable: runtimeData.backendReachable,
        }
        debugLog('[Config] Using runtime config payload:', config)
        return config
      }
    } else {
      debugLog('⚠️ [Config] Runtime config endpoint returned status:', runtimeResponse.status)
    }
  } catch (error) {
    debugLog('⚠️ [Config] Could not fetch runtime config:', error)
  }

  // STEP 2: Fallback to build-time environment variable
  const envApiUrl = process.env.NEXT_PUBLIC_API_URL
  debugLog('🔧 [Config] NEXT_PUBLIC_API_URL from build:', envApiUrl || '(not set)')

  // STEP 3: Smart default - infer API URL from current frontend URL
  // Context-OS: Backend runs on a separate port in local dev
  // In production, they'll be on different ports
  let defaultApiUrl = 'http://localhost:3002'

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol
    debugLog('🔧 [Config] Current frontend URL:', `${protocol}//${hostname}${window.location.port ? ':' + window.location.port : ''}`)

    // If not localhost, use the same hostname with port 3000 (Context-OS backend)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      defaultApiUrl = `${protocol}//${hostname}:3000`
      debugLog('🔧 [Config] Detected remote hostname, using:', defaultApiUrl)
    } else {
      debugLog('🔧 [Config] Detected localhost, using:', defaultApiUrl)
    }
  }

  // Priority: Runtime config > Build-time env var > Smart default
  const baseUrl = normalizeApiUrl(runtimeApiUrl || envApiUrl || defaultApiUrl)
  debugLog('🔧 [Config] Final base URL to try:', baseUrl)
  debugLog('🔧 [Config] Selection priority: runtime=' + (runtimeApiUrl ? '✅' : '❌') +
              ', build-time=' + (envApiUrl ? '✅' : '❌') +
              ', smart-default=' + (!runtimeApiUrl && !envApiUrl ? '✅' : '❌'))

  try {
    debugLog('🔧 [Config] Fetching backend config from:', `${baseUrl}/config`)
    const response = await fetch(`${baseUrl}/config`, {
      cache: 'no-store',
    })

    if (response.ok) {
      const data: BackendConfigResponse = await response.json()
      config = {
        apiUrl: baseUrl,
        version: data.version || 'unknown',
        buildTime: BUILD_TIME,
        latestVersion: data.latestVersion || null,
        hasUpdate: data.hasUpdate || false,
        dbStatus: data.dbStatus,
        backendReachable: true,
      }
      debugLog('✅ [Config] Successfully loaded API config:', config)
      return config
    }

    debugLog('⚠️ [Config] Backend config endpoint returned status:', response.status)
  } catch (error) {
    debugLog('⚠️ [Config] Backend config fetch failed:', error)
  }

  // Never cache a failed Promise: fall back to same-origin API routing
  // so auth requests can still reach backend through Next.js rewrites.
  config = buildFallbackConfig()
  debugLog('⚠️ [Config] Falling back to frontend-origin API URL:', config.apiUrl)
  return config
}

/**
 * Reset the configuration cache (useful for testing).
 */
export function resetConfig(): void {
  config = null
  configPromise = null
}
