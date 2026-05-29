import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/sanity/client', () => ({
  sanityFetch: vi.fn(),
}))

import { sanityFetch } from '@/lib/sanity/client'

describe('GET /api/native-config', () => {
  it('returns streamUrl from Sanity when available', async () => {
    vi.mocked(sanityFetch).mockResolvedValueOnce({ radioAudioURL: 'https://example.com/stream' })
    vi.resetModules()
    const { GET } = await import('@/app/api/native-config/route')
    const res = await GET()
    const body = await res.json()
    expect(body.streamUrl).toBe('https://example.com/stream')
    expect(body.protocolVersion).toBe(1)
    expect(res.headers.get('Cache-Control')).toContain('max-age=300')
  })

  it('falls back to radiojar URL when Sanity fails', async () => {
    vi.mocked(sanityFetch).mockRejectedValueOnce(new Error('Sanity down'))
    vi.resetModules()
    const { GET } = await import('@/app/api/native-config/route')
    const res = await GET()
    const body = await res.json()
    expect(body.streamUrl).toBe('https://stream.radiojar.com/g4d600bv6p5tv')
    expect(res.status).toBe(200)
  })

  it('returns minAppVersion and webUrl fields', async () => {
    vi.mocked(sanityFetch).mockResolvedValueOnce({ radioAudioURL: 'https://example.com/stream' })
    vi.resetModules()
    const { GET } = await import('@/app/api/native-config/route')
    const res = await GET()
    const body = await res.json()
    expect(body.minAppVersion).toMatchObject({ ios: expect.any(String), android: expect.any(String) })
    expect(body.webUrl).toMatch(/^https?:\/\//)
  })
})
