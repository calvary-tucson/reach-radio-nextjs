const RADIOJAR_URL = 'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()
  let interval: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      async function poll() {
        try {
          const res = await fetch(RADIOJAR_URL, {
            signal: AbortSignal.timeout(5_000),
          })
          const text = await res.text()
          const json = JSON.parse(text.substring(1, text.length - 2)) as {
            title?: string
            artist?: string
          }
          const title = json.title || 'Reach Radio'
          const artist = json.artist || ''
          const data = JSON.stringify({ title, artist })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // retain previous state — send nothing on error
        }
      }

      await poll()
      interval = setInterval(poll, 30_000)
    },
    cancel() {
      clearInterval(interval)
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
