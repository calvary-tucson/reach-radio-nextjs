import { describe, it, expect } from 'vitest'
import nextConfig from '../../next.config'

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

  it('allows the pages.dev host in CSP media-src', async () => {
    const headers = await nextConfig.headers?.()
    const csp = headers
      ?.flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value
    expect(csp).toMatch(new RegExp(`media-src[^;]*${PAGES_DEV.replace(/\./g, '\\.')}`))
  })

  it('allows the stream.reach.radio Worker host in CSP media-src', async () => {
    const headers = await nextConfig.headers?.()
    const csp = headers
      ?.flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value
    expect(csp).toMatch(/media-src[^;]*https:\/\/stream\.reach\.radio/)
  })
})
