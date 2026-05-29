import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/theme/route'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/theme', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/theme', () => {
  it('returns 200 and sets cookie for valid theme', async () => {
    const res = await POST(makeRequest({ theme: 'dark' }))
    expect(res.status).toBe(200)
    const cookie = res.cookies.get('theme')
    expect(cookie?.value).toBe('dark')
  })

  it('accepts light and system themes', async () => {
    for (const theme of ['light', 'system'] as const) {
      const res = await POST(makeRequest({ theme }))
      expect(res.status).toBe(200)
      expect(res.cookies.get('theme')?.value).toBe(theme)
    }
  })

  it('returns 400 for invalid theme', async () => {
    const res = await POST(makeRequest({ theme: 'purple' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed body', async () => {
    const req = new NextRequest('http://localhost/api/theme', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
