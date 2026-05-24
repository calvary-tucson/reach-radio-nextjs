'use client'

import { useActionState, useEffect, useRef } from 'react'
import { submitContact, type ContactState } from '@/actions/contact'

const initial: ContactState = { success: false }

export function ContactForm() {
  const [state, action, isPending] = useActionState(submitContact, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const timestampRef = useRef(Date.now().toString())

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  useEffect(() => {
    if (state.error) errorRef.current?.focus()
  }, [state.error])

  return (
    <form ref={formRef} action={action} className="space-y-4 max-w-lg">
      {/* Honeypot fields */}
      <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="url" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="homepage" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="phone" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      <input type="hidden" name="timestamp" value={timestampRef.current} />

      <div>
        <label htmlFor="name" className="text-white/80 text-sm block mb-1">Name *</label>
        <input
          id="name" name="name" type="text" required minLength={2} maxLength={100}
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/80 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/80 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white resize-none"
        />
      </div>

      <label className="flex gap-3 cursor-pointer items-start">
        <input type="checkbox" name="gdprConsent" required className="mt-1" />
        <span className="text-white text-sm leading-relaxed">
          I consent to having my submitted information stored for the purpose of responding to my inquiry. *
        </span>
      </label>

      {state.error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-red-400 text-sm outline-none">{state.error}</p>}
      {state.success && <p role="status" className="text-green-400 text-sm">Message sent! We&apos;ll be in touch.</p>}

      <button
        type="submit" disabled={isPending}
        className="bg-[var(--color-brand-green)] text-white px-6 py-2 rounded font-medium text-sm disabled:opacity-50"
      >
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  )
}
