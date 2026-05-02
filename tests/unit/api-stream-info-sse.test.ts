import { describe, it, expect, vi } from 'vitest'

describe('GET /api/stream-info-sse', () => {
  it('returns text/event-stream content type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '({"song":{"title":"Test Show","artist":"John Doe"}});',
    }))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET()
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })
})
