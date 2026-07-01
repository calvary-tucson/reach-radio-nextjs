'use server'

import { headers } from 'next/headers'
import { getClientIP, checkRateLimit, sanitizeInput } from '@/utils/spam-protection'

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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' }
  }

  if (message.length < 10 || message.length > 2000) {
    return { success: false, error: 'Message must be 10–2000 characters.' }
  }

  if (!gdprConsent) {
    return { success: false, error: 'Please accept the consent checkbox.' }
  }

  if (!process.env.FORMSPREE_ENDPOINT) {
    return { success: false, error: 'Server configuration error.' }
  }

  const dryRun = formData.get('dryRun') === '1'
  const headersList = await headers()

  // Rate limiting — best-effort (resets on cold start)
  const clientIP = getClientIP(headersList)
  if (!checkRateLimit(clientIP)) {
    return { success: false, error: 'Too many submissions. Please try again later.' }
  }

  const isMobileApp =
    headersList.get('mobile-app') === 'true' ||
    headersList.get('cookie')?.includes('mobile-app=true')

  if (!isMobileApp && process.env.RECAPTCHA_SECRET_KEY) {
    if (!recaptchaToken || typeof recaptchaToken !== 'string') {
      return { success: false, error: 'reCAPTCHA verification required.' }
    }

    try {
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        }),
      })
      const verifyData = await verifyRes.json() as { success: boolean; score?: number }

      const threshold = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD ?? '0.5')
      if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < threshold)) {
        return { success: false, error: 'reCAPTCHA verification failed. Please try again.' }
      }
    } catch {
      return { success: false, error: 'Service unavailable. Please try again later.' }
    }
  }

  // Reject messages with 4+ URLs — strong spam signal, rare in legitimate messages
  const linkCount = (message.match(/https?:\/\/[^\s]+/g) ?? []).length
  if (linkCount > 3) {
    return { success: false, error: 'Your submission could not be processed. Please try again.' }
  }

  // Sanitize before forwarding
  const safeName = sanitizeInput(name, 100)
  const safeEmail = sanitizeInput(email, 254)
  const safeMessage = sanitizeInput(message, 2000)

  if (!dryRun) {
    try {
      const formspreeRes = await fetch(process.env.FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: safeName,
          email: safeEmail,
          message: safeMessage,
          gdprConsent: true,
          _subject: 'New Contact Form Submission - Reach Radio',
        }),
      })

      if (!formspreeRes.ok) {
        return { success: false, error: 'Failed to send message. Please try again.' }
      }
    } catch {
      return { success: false, error: 'Service unavailable. Please try again later.' }
    }
  }

  return { success: true }
}
