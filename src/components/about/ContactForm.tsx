'use client'

import { useActionState, useEffect, useRef } from 'react'
import { submitContact, type ContactState } from '@/actions/contact'

const initial: ContactState = { success: false }

export function ContactForm() {
  const [state, action, isPending] = useActionState(submitContact, initial)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <form ref={formRef} action={action} className="space-y-4 max-w-lg">
      <div>
        <label htmlFor="name" className="text-white/80 text-sm block mb-1">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/80 text-sm block mb-1">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/80 text-sm block mb-1">Message</label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20 resize-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-red-400 text-sm">{state.error}</p>
      )}
      {state.success && (
        <p role="status" className="text-green-400 text-sm">Message sent! We&apos;ll be in touch.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-brand-green)] text-white px-6 py-2 rounded font-medium text-sm disabled:opacity-50"
      >
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  )
}
