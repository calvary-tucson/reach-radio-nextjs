import { revalidateTag } from 'next/cache'

const TAG_MAP: Record<string, string> = {
  teacher: 'teachers',
  schedule: 'schedule',
  settings: 'settings',
}

export async function POST(req: Request): Promise<Response> {
  const secret = req.headers.get('x-webhook-secret')

  if (!secret || secret !== process.env.SANITY_WEBHOOK_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { _type?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tag = body._type ? TAG_MAP[body._type] : undefined

  if (tag) {
    revalidateTag(tag)
    return Response.json({ revalidated: true, tag })
  }

  return Response.json({ revalidated: false, reason: 'unknown document type' })
}
