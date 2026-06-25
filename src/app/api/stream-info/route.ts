const RADIOJAR_URL =
  'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(RADIOJAR_URL, {
      next: { revalidate: 0 },
    })
    const text = await res.text()
    // Robust JSONP strip — handles named callback and whitespace variations
    const stripped = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '')
    const json = JSON.parse(stripped) as {
      title?: string
      artist?: string
    }

    const streamTitle = json.title || 'Reach Radio FM'
    const streamArtist = json.artist || ''

    return Response.json({ streamTitle, streamArtist })
  } catch {
    return Response.json({ streamTitle: 'Reach Radio FM', streamArtist: '' }, { status: 200 })
  }
}
