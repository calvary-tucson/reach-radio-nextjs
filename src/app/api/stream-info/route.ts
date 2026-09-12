import { RADIOJAR_URL } from '@/lib/constants'
import { resolveArtist } from '@/lib/teacherCache'

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(RADIOJAR_URL, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 0 },
    })
    const text = await res.text()
    // Robust JSONP strip — handles named callback and whitespace variations
    const stripped = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '')
    const json = JSON.parse(stripped) as { title?: string; artist?: string }

    const title = json.title || 'Reach Radio'
    const artist = json.artist || ''
    const { imageUrl, resolvedArtist } = await resolveArtist(artist)

    return Response.json({ title, artist, streamTitle: title, streamArtist: artist, imageUrl, resolvedArtist })
  } catch {
    return Response.json(
      { title: 'Reach Radio', artist: '', streamTitle: 'Reach Radio', streamArtist: '', imageUrl: null, resolvedArtist: null },
      { status: 200 }
    )
  }
}
