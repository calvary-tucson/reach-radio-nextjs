import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GET /api/stream-info-sse', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
  })

  it('returns text/event-stream content type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '({"title":"Test Show","artist":"John Doe"});',
    }))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET(new Request('http://localhost/'))
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('returns 429 when rate limit exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '({"title":"Test","artist":""});',
    }))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const ip = '1.2.3.4'
    const makeRequest = () => GET(new Request('http://localhost/', {
      headers: { 'x-forwarded-for': ip },
    }))
    // Exhaust the 10-request window
    for (let i = 0; i < 10; i++) await makeRequest()
    const res = await makeRequest()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('emits parsed title and artist in SSE data event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '({"title":"Morning Devotions","artist":"Chuck Smith"});',
    }))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET(new Request('http://localhost/'))
    expect(res.status).toBe(200)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('no body')
    const { value } = await reader.read()
    reader.cancel()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('"title":"Morning Devotions"')
    expect(text).toContain('"artist":"Chuck Smith"')
  })

  it('falls back to Reach Radio on upstream fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    // Polling failure should not throw — stream stays open
    const res = await GET(new Request('http://localhost/'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })
})
