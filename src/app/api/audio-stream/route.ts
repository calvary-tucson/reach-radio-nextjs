const STREAM_URL = 'https://stream.radiojar.com/g4d600bv6p5tv'

export async function GET(): Promise<Response> {
  const controller = new AbortController()
  const connectTimeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const upstream = await fetch(STREAM_URL, { signal: controller.signal })
    clearTimeout(connectTimeout) // connected — don't abort the open stream

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream error', { status: 502 })
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new Response('Stream unavailable', { status: 502 })
  }
}
