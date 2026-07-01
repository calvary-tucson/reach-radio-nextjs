'use client'

import { startTransition, useActionState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { submitContact, type ContactState } from '@/actions/contact'

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

interface ContactFormProps {
  onSuccess?: () => void
}

const initial: ContactState = { success: false }

export function ContactForm({ onSuccess }: ContactFormProps) {
  const [state, formAction, isPending] = useActionState(submitContact, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const timestampRef = useRef(Date.now().toString())
  const searchParams = useSearchParams()
  const dryRun = searchParams.has('contact-dry-run')

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return
    if (document.querySelector('script[data-recaptcha]')) return
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`
    script.async = true
    script.dataset.recaptcha = '1'
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      toast.success("Message sent! We'll be in touch.")
      onSuccess?.()
    }
  }, [state.success, onSuccess])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    if (RECAPTCHA_SITE_KEY) {
      await new Promise<void>((resolve, reject) => {
        const start = Date.now()
        const poll = () => {
          if (typeof window !== 'undefined' && window.grecaptcha) resolve()
          else if (Date.now() - start > 10_000) reject(new Error('grecaptcha load timeout'))
          else setTimeout(poll, 50)
        }
        poll()
      })
      await new Promise<void>((resolve) => window.grecaptcha.ready(resolve))
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'contact' })
      formData.set('recaptchaToken', token)
    }

    startTransition(() => formAction(formData))
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" aria-describedby={state.error ? 'form-error' : undefined}>
      {/* Honeypot fields */}
      <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="url" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="homepage" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="phone" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      <input type="hidden" name="timestamp" value={timestampRef.current} />
      {dryRun && <input type="hidden" name="dryRun" value="1" />}

      <div>
        <label htmlFor="name" className="text-white/90 light:text-gray-700 text-sm block mb-1">Name *</label>
        <input
          id="name" name="name" type="text" required minLength={2} maxLength={100}
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/90 light:text-gray-700 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/90 light:text-gray-700 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none resize-none"
        />
      </div>

      <label className="flex gap-3 cursor-pointer items-start">
        <input type="checkbox" name="gdprConsent" required className="mt-1" />
        <span className="text-white light:text-gray-900 text-sm leading-relaxed">
          I consent to having my submitted information stored for the purpose of responding to my inquiry. *
        </span>
      </label>

      <button
        type="submit" disabled={isPending}
        className="bg-[var(--color-brand-green)] text-[#0a1305] px-6 py-3 min-h-[44px] rounded font-medium text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
      {state.error && (
        <p id="form-error" role="alert" className="text-red-400 text-sm">{state.error}</p>
      )}
    </form>
  )
}
