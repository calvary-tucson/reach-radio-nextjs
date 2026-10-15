import { test, expect } from '@playwright/test'

test('/api/audio-stream 307-redirects to the legacy pages.dev stream', async ({ request }) => {
  const res = await request.get('/api/audio-stream', { maxRedirects: 0 })
  expect(res.status()).toBe(307)
  expect(res.headers()['location']).toBe('https://reach-radio-web.pages.dev/api/audio-stream')
})
