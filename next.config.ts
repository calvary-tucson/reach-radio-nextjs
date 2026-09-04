import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  allowedDevOrigins: ['dev.calvarytucson.com'],
  experimental: {
    serverComponentsHmrCache: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production'
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.google.com https://www.gstatic.com`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https://cdn.sanity.io data: blob: https://www.google.com",
              "media-src 'self' https://*.radiojar.com https://reach.radio",
              "connect-src 'self' https://api.sanity.io https://cdn.sanity.io https://*.radiojar.com https://www.google.com",
              "font-src 'self'",
              "object-src 'none'",
              "frame-src https://www.google.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/speakers/:slug*', destination: '/teachers/:slug*', permanent: true },
    ]
  },
}

export default nextConfig
