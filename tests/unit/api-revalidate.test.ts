import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.SANITY_WEBHOOK_SECRET = 'test-secret'
  })

  it('returns 401 when secret header is missing', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      body: JSON.stringify({ _type: 'teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when secret header is wrong', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'wrong' },
      body: JSON.stringify({ _type: 'teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('calls revalidateTag("teachers") for teacher documents (no second arg)', async () => {
    const { revalidateTag } = await import('next/cache')
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: JSON.stringify({ _type: 'teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('teachers')
  })

  it('calls revalidateTag("settings") for appSettings documents', async () => {
    const { revalidateTag } = await import('next/cache')
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: JSON.stringify({ _type: 'appSettings' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('settings')
  })

  it('returns revalidated: false for unknown document type', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: JSON.stringify({ _type: 'unknownType' }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.revalidated).toBe(false)
  })
})
