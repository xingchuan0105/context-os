import { NextRequest, NextResponse } from 'next/server'

/**
 * Runtime configuration endpoint for frontend
 *
 * This endpoint provides frontend configuration information without requiring authentication.
 * Returns version info and metadata about the frontend application.
 *
 * Location: /config (not /api/config)
 * Method: GET
 * Cache: Disabled (always fresh)
 */
export const dynamic = 'force-dynamic'  // Disable static optimization

function getFrontendOrigin(request: NextRequest): string {
  const explicitOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicitOrigin) {
    return explicitOrigin
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')
  const protocol = (forwardedProto || request.nextUrl.protocol.replace(':', '') || 'http').toLowerCase()

  const forwardedHost = request.headers.get('x-forwarded-host')
  const rawHost = (forwardedHost || request.headers.get('host') || request.nextUrl.host || 'localhost:3003')
    .split(',')[0]
    .trim()

  let normalizedHost = rawHost
  if (normalizedHost.startsWith('0.0.0.0')) {
    normalizedHost = `localhost${normalizedHost.slice('0.0.0.0'.length)}`
  } else if (normalizedHost.startsWith('[::]')) {
    normalizedHost = `localhost${normalizedHost.slice('[::]'.length)}`
  } else if (normalizedHost.startsWith('::1')) {
    normalizedHost = `localhost${normalizedHost.slice('::1'.length)}`
  }

  return `${protocol}://${normalizedHost}`
}

export async function GET(request: NextRequest) {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL ||
      'http://localhost:3002'

    let backendConfig = {
      version: '0.1.0',
      latestVersion: null,
      hasUpdate: false,
    }
    let backendReachable = false

    try {
      const backendResponse = await fetch(`${backendUrl}/config`, {
        cache: 'no-store',
      })
      if (backendResponse.ok) {
        backendConfig = await backendResponse.json()
        backendReachable = true
      }
    } catch (error) {
      console.error('[Config] Backend config fetch failed:', error)
    }

    // Always return the frontend's own origin for apiUrl
    // This allows Next.js rewrites to proxy API calls to the backend
    // In Docker, NEXT_PUBLIC_APP_URL should be set to http://localhost:3003
    const frontendOrigin = getFrontendOrigin(request)

    return NextResponse.json({
      apiUrl: frontendOrigin,
      backendReachable,
      ...backendConfig,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error) {
    console.error('[Config] Error generating config:', error)

    // Always return the frontend's own origin for apiUrl
    const frontendOrigin = getFrontendOrigin(request)

    return NextResponse.json({
      apiUrl: frontendOrigin,
      version: '0.1.0',
      latestVersion: null,
      hasUpdate: false,
      backendReachable: false,
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      }
    })
  }
}
