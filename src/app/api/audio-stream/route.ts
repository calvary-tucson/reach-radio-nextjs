import { createRateLimiter } from '@/lib/rate-limit'
import { FALLBACK_STREAM_URL } from '@/lib/constants'

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 })

export async function GET(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const result = limiter.check(ip)
  if (!result.success) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfter) },
    })
  }

  const controller = new AbortController()
  const connectTimeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const upstream = await fetch(FALLBACK_STREAM_URL, { signal: controller.signal })
    clearTimeout(connectTimeout)

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream error', { status: 502 })
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new Response('Stream unavailable', { status: 502 })
  }
}
