'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { submitContact, type ContactState } from '@/actions/contact'

const initial: ContactState = { success: false }

export function ContactForm() {
  const [state, action, isPending] = useActionState(submitContact, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const timestampRef = useRef(Date.now().toString())

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      toast.success("Message sent! We'll be in touch.")
    }
  }, [state.success])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])

  return (
    <form ref={formRef} action={action} className="space-y-4 max-w-lg" aria-describedby={state.error ? 'form-error' : undefined}>
      {/* Honeypot fields */}
      <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="url" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="homepage" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="phone" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      <input type="hidden" name="timestamp" value={timestampRef.current} />

      <div>
        <label htmlFor="name" className="text-white/80 light:text-gray-700 text-sm block mb-1">Name *</label>
        <input
          id="name" name="name" type="text" required minLength={2} maxLength={100}
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white light:focus:ring-gray-400"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/80 light:text-gray-700 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white light:focus:ring-gray-400"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/80 light:text-gray-700 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white light:focus:ring-gray-400 resize-none"
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
        className="bg-[var(--color-brand-green)] text-white px-6 py-2 rounded font-medium text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
      {state.error && (
        <p id="form-error" role="alert" className="text-red-400 text-sm">{state.error}</p>
      )}
    </form>
  )
}
