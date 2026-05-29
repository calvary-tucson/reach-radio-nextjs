import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const theme = (body as Record<string, unknown>)?.theme
  if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
    return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('theme', theme, {
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  })
  return res
}
