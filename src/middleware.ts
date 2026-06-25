import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()

  const hasMobileHeader = request.headers.get('mobile-app') === 'true'
  const hasMobileCookie = request.cookies.get('mobile-app')?.value === 'true'

  if (hasMobileHeader && !hasMobileCookie) {
    response.cookies.set('mobile-app', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: false, // BridgeInit reads and clears this cookie client-side
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
