import { createRateLimiter } from '@/lib/rate-limit'
import { RADIOJAR_URL } from '@/lib/constants'

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 })

const MAX_POLL_BACKOFF_MS = 5 * 60_000
const MAX_CONNECTION_MS = 30 * 60_000

export async function GET(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const result = limiter.check(ip)
  if (!result.success) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'Content-Type': 'text/plain',
      },
    })
  }

  const encoder = new TextEncoder()
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let keepaliveInterval: ReturnType<typeof setInterval> | undefined
  let connectionTimeout: ReturnType<typeof setTimeout> | undefined
  const abortController = new AbortController()
  let cancelled = false
  let consecutiveFailures = 0

  const stream = new ReadableStream({
    async start(controller) {
      function schedulePoll(delay: number) {
        if (cancelled) return
        pollTimer = setTimeout(() => void poll(), delay)
      }

      async function poll() {
        if (cancelled) return
        try {
          const res = await fetch(RADIOJAR_URL, {
            signal: AbortSignal.any([
              AbortSignal.timeout(5_000),
              abortController.signal,
            ]),
          })
          const text = await res.text()
          // Robust JSONP strip — handles named callback and whitespace variations
          const stripped = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '')
          const json = JSON.parse(stripped) as { title?: string; artist?: string }
          const title = json.title || 'Reach Radio'
          const artist = json.artist || ''
          consecutiveFailures = 0
          if (!cancelled) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ title, artist })}\n\n`))
          }
          schedulePoll(30_000)
        } catch {
          if (!cancelled) {
            consecutiveFailures++
            // Back off exponentially from 30s up to 5 min on repeated upstream failures
            const delay = Math.min(30_000 * Math.pow(2, consecutiveFailures - 1), MAX_POLL_BACKOFF_MS)
            schedulePoll(delay)
          }
        }
      }

      // Keepalive comments every 15s prevent proxy/Vercel from closing idle connections
      keepaliveInterval = setInterval(() => {
        if (!cancelled) {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            cancelled = true
          }
        }
      }, 15_000)

      // Absolute connection timeout — forces client reconnect after 30 min
      connectionTimeout = setTimeout(() => {
        cancelled = true
        clearTimeout(pollTimer)
        clearInterval(keepaliveInterval)
        abortController.abort()
        try { controller.close() } catch { /* already closed */ }
      }, MAX_CONNECTION_MS)

      await poll()
    },
    cancel() {
      cancelled = true
      clearTimeout(pollTimer)
      clearTimeout(connectionTimeout)
      clearInterval(keepaliveInterval)
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
    },
  })
}
