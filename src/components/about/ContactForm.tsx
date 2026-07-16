'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { submitContact, type ContactState } from '@/actions/contact'

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

interface ContactFormProps {
  onSuccess?: () => void
  dryRun?: boolean
}

const initial: ContactState = { success: false }

export function ContactForm({ onSuccess, dryRun = false }: ContactFormProps) {
  const [state, formAction, isPending] = useActionState(submitContact, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const [timestamp] = useState(() => Date.now().toString())
  const prevStateRef = useRef(state)

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
    if (state !== prevStateRef.current && state.success) {
      formRef.current?.reset()
      toast.success("Message sent! We'll be in touch.")
      onSuccess?.()
    }
    prevStateRef.current = state
  }, [state, onSuccess])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    if (RECAPTCHA_SITE_KEY) {
      try {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('timeout')), 5000)
          window.grecaptcha.ready(() => { clearTimeout(t); resolve() })
        })
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'contact' })
        formData.set('recaptchaToken', token)
      } catch {
        toast.error('Security check failed. Please try again.')
        return
      }
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
      <input type="hidden" name="timestamp" value={timestamp} />
      {dryRun && <input type="hidden" name="dryRun" value="1" />}

      <div>
        <label htmlFor="name" className="text-white/90 light:text-gray-700 text-sm block mb-1">Name *</label>
        <input
          id="name" name="name" type="text" required minLength={2} maxLength={100}
          data-native-focus
          className="w-full h-11 bg-gray-700/50 light:bg-gray-100 border border-white/10 light:border-gray-300 text-white light:text-gray-900 rounded px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/90 light:text-gray-700 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          data-native-focus
          className="w-full h-11 bg-gray-700/50 light:bg-gray-100 border border-white/10 light:border-gray-300 text-white light:text-gray-900 rounded px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/90 light:text-gray-700 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          data-native-focus
          className="w-full bg-gray-700/50 light:bg-gray-100 border border-white/10 light:border-gray-300 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none resize-none"
        />
      </div>

      <label className="flex gap-3 cursor-pointer items-start">
        <input type="checkbox" name="gdprConsent" required data-native-focus className="mt-1 h-6 w-6 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" />
        <span className="text-white light:text-gray-900 text-sm leading-relaxed">
          I consent to having my submitted information stored for the purpose of responding to my inquiry. *
        </span>
      </label>

      <button
        type="submit" disabled={isPending}
        data-native-focus
        className="inline-flex items-center gap-2 bg-[var(--color-brand-green)] text-[#0a1305] px-6 py-3 min-h-[44px] rounded font-medium text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {isPending && (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 shrink-0 border-2 border-[#0a1305] border-t-transparent rounded-full motion-safe:animate-spin"
            />
            <span role="status" aria-label="Sending..." className="sr-only" />
          </>
        )}
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
      {state.error && (
        <p id="form-error" role="alert" className="text-red-400 light:text-red-600 text-sm">{state.error}</p>
      )}
    </form>
  )
}
