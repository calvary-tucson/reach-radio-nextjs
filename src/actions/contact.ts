'use server'

export interface ContactState {
  success: boolean
  error?: string
}

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = formData.get('name')
  const email = formData.get('email')
  const message = formData.get('message')
  const recaptchaToken = formData.get('recaptchaToken')

  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return { success: false, error: 'Invalid form data.' }
  }

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

  const formspreeRes = await fetch(process.env.FORMSPREE_ENDPOINT ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name, email, message }),
  })

  if (!formspreeRes.ok) {
    return { success: false, error: 'Failed to send message. Please try again.' }
  }

  return { success: true }
}
