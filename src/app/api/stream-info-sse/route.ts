// RETIRED 2026-11-13. Now-playing SSE lives on the Cloudflare Worker
// (NOW_PLAYING_SSE_URL in @/lib/constants). This route used to hold each request
// open for 10-12 min, and Vercel Fluid compute billed provisioned memory for all
// of it; stale browser tabs kept reconnecting (Nov 13 log: Android Chrome tab,
// 11m32s per connection). A 204 tells EventSource to stop reconnecting for good.
// Never redirect: an EventSource would follow it and keep a connection open.
// iOS v4 NowPlayingService must be repointed to the Worker before release.
// Detail: docs/bugs/vercel-usage-spike-2026-11.md.

export const maxDuration = 5

export function GET(): Response {
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}
