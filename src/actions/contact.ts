'use server'

import { headers } from 'next/headers'

export interface ContactState {
  success: boolean
  error?: string
}

const MIN_SUBMIT_MS = 3_000

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = formData.get('name')
  const email = formData.get('email')
  const message = formData.get('message')
  const gdprConsent = formData.get('gdprConsent')
  const recaptchaToken = formData.get('recaptchaToken')
  const timestamp = formData.get('timestamp')

  // Honeypot check — any value means a bot; silently succeed
  const honeypots = ['website', 'url', 'homepage', 'phone']
  for (const field of honeypots) {
    if (formData.get(field)) {
      return { success: true }
    }
  }

  // Timing check — bots submit instantly
  if (timestamp) {
    const elapsed = Date.now() - Number(timestamp)
    if (elapsed < MIN_SUBMIT_MS) {
      return { success: true }
    }
  }

  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return { success: false, error: 'Invalid form data.' }
  }

  if (name.length < 2 || name.length > 100) {
    return { success: false, error: 'Name must be 2–100 characters.' }
  }

  if (message.length < 10 || message.length > 2000) {
    return { success: false, error: 'Message must be 10–2000 characters.' }
  }

  if (!gdprConsent) {
    return { success: false, error: 'Please accept the consent checkbox.' }
  }

  const headersList = await headers()
  const isMobileApp =
    headersList.get('mobile-app') === 'true' ||
    headersList.get('cookie')?.includes('mobile-app=true')

  if (!isMobileApp) {
    if (!recaptchaToken || typeof recaptchaToken !== 'string') {
      return { success: false, error: 'reCAPTCHA verification required.' }
    }

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY ?? '',
        response: recaptchaToken,
      }),
    })
    const verifyData = await verifyRes.json() as { success: boolean; score?: number }

    if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.5)) {
      return { success: false, error: 'reCAPTCHA verification failed. Please try again.' }
    }
  }

  const formspreeRes = await fetch(process.env.FORMSPREE_ENDPOINT ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name,
      email,
      message,
      gdprConsent: true,
      _subject: 'New Contact Form Submission - Reach Radio',
    }),
  })

  if (!formspreeRes.ok) {
    return { success: false, error: 'Failed to send message. Please try again.' }
  }

  return { success: true }
}
