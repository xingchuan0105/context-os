import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
]

const nextConfig: NextConfig = {
  /* config options here */

  // Standalone output for Docker deployment
  output: 'standalone',

  // Turbopack configuration (disabled for production builds)
  // turbopack: {},

  // Externalize better-sqlite3 to prevent bundling
  serverExternalPackages: ['better-sqlite3'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },

}

export default nextConfig
