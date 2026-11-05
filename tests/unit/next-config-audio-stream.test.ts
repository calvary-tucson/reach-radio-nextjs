import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import nextConfig from '../../next.config'
import { WEB_AUDIO_STREAM_URL } from '@/lib/constants'
import { readFileSync } from 'node:fs'

const PAGES_DEV = 'https://reach-radio-web.pages.dev'

describe('next.config audio stream', () => {
  it('temporarily redirects /api/audio-stream to pages.dev', async () => {
    const redirects = await nextConfig.redirects?.()
    expect(redirects).toContainEqual({
      source: '/api/audio-stream',
      destination: `${PAGES_DEV}/api/audio-stream`,
      permanent: false,
    })
  })

  it('has no route.ts that the redirect would silently shadow', () => {
    expect(existsSync(join(process.cwd(), 'src/app/api/audio-stream/route.ts'))).toBe(false)
  })

  it('allows the pages.dev host in CSP media-src', async () => {
    const headers = await nextConfig.headers?.()
    const csp = headers
      ?.flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value
    expect(csp).toMatch(new RegExp(`media-src[^;]*${PAGES_DEV.replace(/\./g, '\\.')}`))
  })

  it('allows the stream.reach.radio Worker host in CSP connect-src (now-playing SSE)', async () => {
    const headers = await nextConfig.headers?.()
    const csp = headers
      ?.flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value
    expect(csp).toMatch(/connect-src[^;]*https:\/\/stream\.reach\.radio/)
  })

  it('allows the stream.reach.radio Worker host in CSP media-src', async () => {
    const headers = await nextConfig.headers?.()
    const csp = headers
      ?.flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value
    expect(csp).toMatch(/media-src[^;]*https:\/\/stream\.reach\.radio/)
  })

  it('web player plays the stream Worker directly, native config untouched', () => {
    expect(WEB_AUDIO_STREAM_URL).toBe('https://stream.reach.radio/')
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    expect(layout).toContain('<AudioProvider streamUrl={WEB_AUDIO_STREAM_URL} />')
    expect(layout).toContain('<BridgeInit streamUrl={streamUrl} />')
  })
})
