const RADIOJAR_URL = 'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()
  let interval: ReturnType<typeof setInterval> | undefined
  const abortController = new AbortController()
  let cancelled = false

  const stream = new ReadableStream({
    async start(controller) {
      async function poll() {
        if (cancelled) return
        try {
          const res = await fetch(RADIOJAR_URL, {
            signal: AbortSignal.any([
              AbortSignal.timeout(5_000),
              abortController.signal,
            ]),
          })
          const text = await res.text()
          const json = JSON.parse(text.substring(1, text.length - 2)) as {
            title?: string
            artist?: string
          }
          const title = json.title || 'Reach Radio'
          const artist = json.artist || ''
          const data = JSON.stringify({ title, artist })
          if (!cancelled) {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
        } catch {
          // retain previous state on error or abort
        }
      }

      await poll()
      interval = setInterval(poll, 30_000)
    },
    cancel() {
      cancelled = true
      clearInterval(interval)
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
    },
  })
}
