import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverComponentsHmrCache: true,
    viewTransition: true,
    useCache: true,
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
    return [
      {
        source: '/js/iFrameResizer.contentWindow.min.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' cdn.sanity.io data: blob: https://www.google.com",
              "media-src 'self' https://*.radiojar.com https://reach.radio",
              "connect-src 'self' api.sanity.io cdn.sanity.io *.radiojar.com https://formspree.io https://www.google.com",
              "font-src 'self'",
              "object-src 'none'",
              "frame-src https://forms.ministryforms.net",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self' https://formspree.io",
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
