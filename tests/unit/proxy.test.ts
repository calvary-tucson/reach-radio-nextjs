import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy as middleware } from '@/proxy'

function makeRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost${path}`)
  return new NextRequest(url, { headers })
}

describe('middleware', () => {
  it('sets mobile-app cookie when mobile-app header is present', async () => {
    const req = makeRequest('/about', { 'mobile-app': 'true' })
    const res = await middleware(req)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('mobile-app=true')
    expect(setCookie).toContain('Max-Age=31536000')
    // Not HttpOnly — BridgeInit.tsx needs to clear this when the bridge is absent
    expect(setCookie).not.toContain('HttpOnly')
  })

  it('does not set mobile-app cookie when header is absent', async () => {
    const req = makeRequest('/about')
    const res = await middleware(req)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('passes through requests without modification when no mobile-app header', async () => {
    const req = makeRequest('/teachers')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })
})
