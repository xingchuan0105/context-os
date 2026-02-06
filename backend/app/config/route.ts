import { NextResponse } from 'next/server'

/**
 * Runtime configuration endpoint for frontend
 *
 * This endpoint provides configuration information to the frontend
 * without requiring authentication or going through the API layer.
 *
 * Location: /config (not /api/config)
 * Method: GET
 * Cache: Disabled (always fresh)
 */
export const dynamic = 'force-dynamic'  // Disable static optimization

export async function GET() {
  try {
    // Get version from package.json
    const version = '0.1.0'  // From package.json

    // Check database status
    let dbStatus: "online" | "offline" = "offline"
    try {
      const { db } = await import('@/lib/db/schema')
      // Simple ping query
      db.prepare('SELECT 1').get()
      dbStatus = "online"
    } catch (error) {
      console.error('Database status check failed:', error)
      dbStatus = "offline"
    }

    // Return configuration
    return NextResponse.json({
      version,
      latestVersion: null,  // TODO: Implement version check API
      hasUpdate: false,
      dbStatus,
    }, {
      // Headers for caching and CORS
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error) {
    console.error('[Config] Error generating config:', error)

    // Return safe defaults on error
    return NextResponse.json({
      version: '0.1.0',
      latestVersion: null,
      hasUpdate: false,
      dbStatus: "offline" as const,
    }, {
      status: 500,  // But still return JSON
      headers: {
        'Cache-Control': 'no-store',
      }
    })
  }
}
