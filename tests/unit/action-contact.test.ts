import { describe, it, expect, vi, beforeEach } from 'vitest'
import { headers } from 'next/headers'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
}))

function mockMobileAppHeaders() {
  vi.mocked(headers).mockResolvedValueOnce({
    get: (key: string) => (key === 'mobile-app' ? 'true' : null),
  } as unknown as Awaited<ReturnType<typeof headers>>)
}

describe('submitContact Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.RECAPTCHA_SECRET_KEY = 'test-key'
    process.env.FORMSPREE_ENDPOINT = 'https://formspree.io/f/test'
  })

  it('returns error when reCAPTCHA token is missing', async () => {
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'John')
    formData.set('email', 'john@example.com')
    formData.set('message', 'Hello there, this is a test message for the contact form.')
    formData.set('gdprConsent', 'on')
    const result = await submitContact({ success: false }, formData)
    expect(result.success).toBe(false)
    expect(result.error).toContain('verification')
  })

  it('returns error when reCAPTCHA verification fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }))
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'John')
    formData.set('email', 'john@example.com')
    formData.set('message', 'Hello there, this is a test message for the contact form.')
    formData.set('gdprConsent', 'on')
    formData.set('recaptchaToken', 'bad-token')
    const result = await submitContact({ success: false }, formData)
    expect(result.success).toBe(false)
    expect(result.error).toContain('verification')
  })

  it('silently succeeds when honeypot field is filled', async () => {
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'Bot')
    formData.set('email', 'bot@example.com')
    formData.set('message', 'This is spam with more than ten characters')
    formData.set('gdprConsent', 'on')
    formData.set('website', 'http://spam.com') // honeypot filled
    formData.set('timestamp', String(Date.now() - 10_000))
    formData.set('recaptchaToken', 'valid-token')
    const result = await submitContact({ success: false }, formData)
    expect(result.success).toBe(true) // silent success to confuse bots
  })

  it('blocks submission with more than 3 links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.9 }),
    }))
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'Alice')
    formData.set('email', 'alice@gmail.com')
    formData.set('message', 'Check http://a.com http://b.com http://c.com http://d.com for deals!')
    formData.set('gdprConsent', 'on')
    formData.set('timestamp', String(Date.now() - 10_000))
    formData.set('recaptchaToken', 'valid-token')
    const result = await submitContact({ success: false }, formData)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/submission|processed|try again/i)
  })

  it('returns error when rate limit exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.9 }),
    }))
    const { submitContact } = await import('@/actions/contact')
    const makeSubmission = async () => {
      const formData = new FormData()
      formData.set('name', 'Alice')
      formData.set('email', 'alice@gmail.com')
      formData.set('message', 'Hello from Reach Radio fan, this is a nice message!')
      formData.set('gdprConsent', 'on')
      formData.set('timestamp', String(Date.now() - 10_000))
      formData.set('recaptchaToken', 'valid-token')
      return submitContact({ success: false }, formData)
    }
    // First 3 succeed (or hit Formspree mock); 4th is rate-limited
    await makeSubmission()
    await makeSubmission()
    await makeSubmission()
    const result = await makeSubmission()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/too many|try again/i)
  })

  it('skips reCAPTCHA when key is unset in non-production', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'Alice')
    formData.set('email', 'alice@gmail.com')
    formData.set('message', 'Hello from Reach Radio fan, this is a nice message!')
    formData.set('gdprConsent', 'on')
    formData.set('timestamp', String(Date.now() - 10_000))
    formData.set('dryRun', '1')
    const result = await submitContact({ success: false }, formData)
    // If reCAPTCHA were NOT skipped, it would return error 'reCAPTCHA verification required.'
    // because no recaptchaToken is set. success=true proves the skip path fired.
    expect(result.success).toBe(true)
  })

  it('rejects mobile-app traffic without a reCAPTCHA token', async () => {
    mockMobileAppHeaders()
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'John')
    formData.set('email', 'john@example.com')
    formData.set('message', 'Hello there, this is a test message for the contact form.')
    formData.set('gdprConsent', 'on')
    const result = await submitContact({ success: false }, formData)
    // The mobile-app header/cookie is unauthenticated and must never bypass verification outright.
    expect(result.success).toBe(false)
    expect(result.error).toContain('verification')
  })

  it('grades mobile-app traffic against RECAPTCHA_SCORE_THRESHOLD_APP instead of skipping verification', async () => {
    process.env.RECAPTCHA_SCORE_THRESHOLD = '0.7'
    process.env.RECAPTCHA_SCORE_THRESHOLD_APP = '0.3'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.5 }),
    })
    vi.stubGlobal('fetch', fetchMock)
    mockMobileAppHeaders()
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'Alice')
    formData.set('email', 'alice@gmail.com')
    formData.set('message', 'Hello from Reach Radio fan, this is a nice message!')
    formData.set('gdprConsent', 'on')
    formData.set('timestamp', String(Date.now() - 10_000))
    formData.set('recaptchaToken', 'valid-token')
    formData.set('dryRun', '1')
    const result = await submitContact({ success: false }, formData)
    // Score 0.5 is below the normal 0.7 threshold but above the app threshold of 0.3 —
    // succeeding here proves the app threshold is actually applied, not just that
    // verification runs. Asserting the siteverify fetch fired at all rules out the
    // old bypass path, which would also return success:true but without ever calling it.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.google.com/recaptcha/api/siteverify',
      expect.anything()
    )
    expect(result.success).toBe(true)
    delete process.env.RECAPTCHA_SCORE_THRESHOLD
    delete process.env.RECAPTCHA_SCORE_THRESHOLD_APP
  })
})
