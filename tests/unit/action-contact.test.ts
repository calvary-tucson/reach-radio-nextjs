import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
}))

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
})
