import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GET /api/audio-stream', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
  })

  it('returns 502 when upstream fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')))
    const { GET } = await import('@/app/api/audio-stream/route')
    const res = await GET()
    expect(res.status).toBe(502)
  })

  it('returns stream response with correct content-type on success', async () => {
    const mockBody = new ReadableStream()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
    }))
    const { GET } = await import('@/app/api/audio-stream/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
  })
})
