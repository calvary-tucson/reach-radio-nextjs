import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/teacherCache', () => ({
  resolveArtist: vi.fn().mockResolvedValue({ imageUrl: null, resolvedArtist: null }),
}))

describe('GET /api/stream-info-sse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns text/event-stream content type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '({"title":"Test Show","artist":"John Doe"});',
    }))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET()
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('sets maxDuration to 780 seconds', async () => {
    const { maxDuration } = await import('@/app/api/stream-info-sse/route')
    expect(maxDuration).toBe(780)
  })

  it('emits parsed title and artist in SSE data event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '({"title":"Morning Devotions","artist":"Chuck Smith"});',
    }))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET()
    expect(res.status).toBe(200)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('no body')
    const { value } = await reader.read()
    reader.cancel()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('"title":"Morning Devotions"')
    expect(text).toContain('"artist":"Chuck Smith"')
    expect(text).toContain('"imageUrl":null')
    expect(text).toContain('"resolvedArtist":null')
  })

  it('falls back to Reach Radio on upstream fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    // Polling failure should not throw — stream stays open
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  describe('connection timeout jitter', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('schedules the connection-close timeout within the jittered 10-12 minute window', async () => {
      // Never resolves, so the poll's own async continuation (which schedules
      // its own setTimeout via schedulePoll) can't land before we inspect —
      // isolates the connectionTimeout call, set synchronously before `await poll()`.
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      const { GET } = await import('@/app/api/stream-info-sse/route')
      await GET()

      const connectionTimeoutCall = setTimeoutSpy.mock.calls.find(
        (call) => typeof call[1] === 'number' && call[1] >= 600_000 && call[1] < 720_000
      )
      expect(connectionTimeoutCall).toBeDefined()
    })
  })
})
