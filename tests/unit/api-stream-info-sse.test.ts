import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GET /api/stream-info-sse (retired)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 204 so EventSource clients stop reconnecting', async () => {
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET()
    expect(res.status).toBe(204)
    expect(res.body).toBeNull()
  })

  it('is not cacheable, so a later change takes effect at once', async () => {
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET()
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('does not hold the request open or call upstream', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { GET, maxDuration } = await import('@/app/api/stream-info-sse/route')
    await GET()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(maxDuration).toBeLessThanOrEqual(10)
  })
})
