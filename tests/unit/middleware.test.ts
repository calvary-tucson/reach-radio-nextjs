import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function makeRequest(
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {},
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return new NextRequest('http://localhost:3000/', {
    headers: {
      ...headers,
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })
}

describe('middleware', () => {
  it('sets mobile-app cookie when header present and no cookie', () => {
    const req = makeRequest({ 'mobile-app': 'true' })
    const res = middleware(req)
    expect(res.cookies.get('mobile-app')?.value).toBe('true')
  })

  it('does not set cookie when mobile-app cookie already exists', () => {
    const req = makeRequest({ 'mobile-app': 'true' }, { 'mobile-app': 'true' })
    const res = middleware(req)
    expect(res.cookies.get('mobile-app')).toBeUndefined()
  })

  it('does not set cookie when no mobile-app header', () => {
    const req = makeRequest()
    const res = middleware(req)
    expect(res.cookies.get('mobile-app')).toBeUndefined()
  })

  it('does not set cookie when mobile-app header is not "true"', () => {
    const req = makeRequest({ 'mobile-app': 'false' })
    const res = middleware(req)
    expect(res.cookies.get('mobile-app')).toBeUndefined()
  })
})
