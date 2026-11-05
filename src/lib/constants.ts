export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reach-radio-nextjs.vercel.app'

export const FALLBACK_STREAM_URL = 'https://stream.radiojar.com/g4d600bv6p5tv'

export const FALLBACK_HOST_URL = SITE_URL

export const FALLBACK_OG_IMAGE =
  'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

// Default player title (mirrors the media store initial value). The Cloudflare
// SSE endpoint sends 'Reach Radio FM' when radiojar has no title.
export const DEFAULT_TITLE = 'Reach Radio'
export const CLOUDFLARE_FALLBACK_TITLE = 'Reach Radio FM'

export const RADIOJAR_URL =
  'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='

// Now-playing SSE is served from Cloudflare: Vercel bills provisioned memory
// for every second an SSE request stays open, Cloudflare does not bill duration.
export const NOW_PLAYING_SSE_URL = 'https://reach-radio-web.pages.dev/api/stream-info-sse'
