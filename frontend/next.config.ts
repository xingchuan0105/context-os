import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
