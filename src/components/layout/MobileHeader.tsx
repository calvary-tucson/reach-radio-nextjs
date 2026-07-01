'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useScrollHide } from '@/lib/hooks/useScrollHide'
import { ContactSheet } from '@/components/about/ContactSheet'

export function MobileHeader() {
  const ref = useScrollHide<HTMLElement>()
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <header
      ref={ref}
      data-web-chrome=""
      className="md:hidden fixed top-0 z-50 flex items-center justify-between w-full min-h-[64px] px-4 bg-black light:bg-white border-b border-b-white/10 light:border-b-gray-200 will-change-transform"
    >
      <Link href="/" aria-label="Reach Radio home" className="w-[clamp(180px,40vw,250px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded">
        <Image
          src="/reach_radio_logo.svg"
          alt=""
          width={248}
          height={58}
          className="h-8 w-auto"
          priority
        />
      </Link>
      <div className="flex items-center gap-4">
        <a
          href="https://www.facebook.com/reachradiotucson"
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 min-h-[44px] flex items-center fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 motion-safe:transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
          aria-label="Reach Radio on Facebook"
        >
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path d="M36.002 18.11a18 18 0 10-20.816 17.891V23.345h-4.567v-5.233h4.571v-3.993c0-4.538 2.688-7.044 6.8-7.044a27.53 27.53 0 014.029.353v4.454h-2.27a2.61 2.61 0 00-2.931 2.83v3.4h4.984l-.8 5.233h-4.2v12.656a18.081 18.081 0 0015.2-17.891z" fill="inherit" />
          </svg>
        </a>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          aria-expanded={contactOpen}
          className="flex items-center h-11 px-3 bg-white light:border light:border-gray-800 rounded text-black font-bold text-sm hover:bg-gray-100 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          Contact
        </button>
        <ContactSheet open={contactOpen} onClose={() => setContactOpen(false)} />
      </div>
    </header>
  )
}
