import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'crypto'

const TAG_MAP: Record<string, string> = {
  teacher: 'teachers',
  schedule: 'teachers', // schedule documents live on the teachers page — invalidate teachers cache
  siteSettings: 'siteSettings',
  appSettings: 'appSettings',
}

const REPLAY_WINDOW_MS = 5 * 60_000

export async function POST(req: Request): Promise<Response> {
  const secret = req.headers.get('x-webhook-secret')
  const webhookSecret = process.env.SANITY_WEBHOOK_SECRET

  if (!secret || !webhookSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secretBuf = Buffer.from(secret)
  const expectedBuf = Buffer.from(webhookSecret)
  if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { _type?: string; _updatedAt?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Replay protection: if _updatedAt is present, reject stale requests
  if (body._updatedAt) {
    const updatedAt = new Date(body._updatedAt).getTime()
    if (isNaN(updatedAt) || Date.now() - updatedAt > REPLAY_WINDOW_MS) {
      return Response.json({ error: 'Request expired' }, { status: 400 })
    }
  }

  const tag = body._type ? TAG_MAP[body._type] : undefined

  if (tag) {
    revalidateTag(tag, 'max')
    return Response.json({ revalidated: true, tag })
  }

  return Response.json({ revalidated: false, reason: 'unknown document type' })
}
