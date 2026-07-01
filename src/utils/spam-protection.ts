// In-memory store for rate limiting.
// Best-effort only — resets on Vercel cold starts. Acceptable for low-volume contact form.
const submissionHistory = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const MAX_SUBMISSIONS = 3

export function getClientIP(headers: { get(name: string): string | null }): string {
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf
  const real = headers.get('x-real-ip')
  if (real) return real
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS

  for (const [key, timestamps] of submissionHistory) {
    const fresh = timestamps.filter(t => t > windowStart)
    if (fresh.length === 0) submissionHistory.delete(key)
    else submissionHistory.set(key, fresh)
  }

  const timestamps = submissionHistory.get(ip) ?? []
  const recent = timestamps.filter(t => t > windowStart)

  if (recent.length >= MAX_SUBMISSIONS) return false
  submissionHistory.set(ip, [...recent, now])
  return true
}

export function sanitizeInput(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/data:/gi, '')
    .substring(0, maxLength)
}
