'use client'

import Link from 'next/link'
import { useState } from 'react'

const BUTTON_CLASS =
  'w-full md:w-auto inline-flex items-center justify-center px-6 py-3 bg-[#84b84f] hover:bg-[#96cc5e] text-[#0a1305] font-bold uppercase rounded-full cursor-pointer motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function ListenButton() {
  const [closeFailed, setCloseFailed] = useState(false)

  // This page is a cold landing from PushPay's redirect — on web it's
  // typically a second tab opened from the original /donate tab. If an
  // opener exists, prefer returning to it over reloading the whole app a
  // second time in this tab.
  if (closeFailed) {
    return (
      <Link href="/" className={BUTTON_CLASS}>
        Listen
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={BUTTON_CLASS}
      onClick={() => {
        if (typeof window !== 'undefined' && window.opener) {
          window.close()
          // Browsers only allow window.close() on script-opened tabs and
          // silently no-op otherwise. If we're still here shortly after,
          // the close was refused — degrade to a normal link rather than
          // leaving a dead button.
          window.setTimeout(() => setCloseFailed(true), 300)
          return
        }
        window.location.href = '/'
      }}
    >
      Listen
    </button>
  )
}
