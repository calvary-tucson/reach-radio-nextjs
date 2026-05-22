/**
 * In-memory sliding-window rate limiter for API routes.
 *
 * NOTE: On Vercel serverless each instance has its own Map — limits
 * per-instance, not globally. Sufficient for this app's scale.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimiterOptions {
  /** Time window in ms (default: 60_000) */
  windowMs?: number
  /** Max requests per window per IP (default: 30) */
  max?: number
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60_000
  const max = options.max ?? 30
  const store = new Map<string, RateLimitEntry>()
  const PRUNE_INTERVAL = 5 * 60_000
  let lastPrune = Date.now()

  function prune() {
    const now = Date.now()
    if (now - lastPrune < PRUNE_INTERVAL) return
    lastPrune = now
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }

  return {
    check(ip: string): { success: true } | { success: false; retryAfter: number } {
      prune()
      const now = Date.now()
      const entry = store.get(ip)
      if (!entry || entry.resetAt <= now) {
        store.set(ip, { count: 1, resetAt: now + windowMs })
        return { success: true }
      }
      entry.count++
      if (entry.count > max) {
        return { success: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
      }
      return { success: true }
    },
  }
}
