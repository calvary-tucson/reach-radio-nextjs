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
})
