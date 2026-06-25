import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('GET /api/audio-stream', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
  })

  it('returns 429 when rate limit exceeded', async () => {
    const mockBody = new ReadableStream()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
    }))
    const { GET } = await import('@/app/api/audio-stream/route')
    const ip = '5.6.7.8'
    const makeRequest = () => GET(new Request('http://localhost/', {
      headers: { 'x-forwarded-for': ip },
    }))
    // Exhaust the 10-request window
    for (let i = 0; i < 10; i++) await makeRequest()
    const res = await makeRequest()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('treats missing x-forwarded-for as unknown IP bucket', async () => {
    const mockBody = new ReadableStream()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
    }))
    const { GET } = await import('@/app/api/audio-stream/route')
    // No x-forwarded-for header → falls into 'unknown' bucket
    const res = await GET(new Request('http://localhost/'))
    expect(res.status).toBe(200)
  })

  it('returns 502 when upstream fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')))
    const { GET } = await import('@/app/api/audio-stream/route')
    const res = await GET(new Request('http://localhost/'))
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
    const res = await GET(new Request('http://localhost/'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
  })

  it('clears the abort timeout after connection succeeds', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const mockBody = new ReadableStream()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
    }))
    const { GET } = await import('@/app/api/audio-stream/route')
    const res = await GET(new Request('http://localhost/'))
    expect(res.status).toBe(200)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })

  describe('connection timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('aborts and returns 502 if connection takes more than 10 seconds', async () => {
      let capturedSignal: AbortSignal | undefined
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        capturedSignal = opts?.signal
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
      }))

      const { GET } = await import('@/app/api/audio-stream/route')
      const responsePromise = GET(new Request('http://localhost/'))

      await vi.advanceTimersByTimeAsync(11_000)

      const res = await responsePromise
      expect(res.status).toBe(502)
      expect(capturedSignal?.aborted).toBe(true)
    })
  })
})
