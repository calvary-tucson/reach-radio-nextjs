import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next()

  if (request.headers.get('mobile-app') === 'true') {
    response.cookies.set('mobile-app', 'true', {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
      sameSite: 'lax',
      // Not httpOnly — BridgeInit.tsx needs to clear this when the bridge is absent
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
