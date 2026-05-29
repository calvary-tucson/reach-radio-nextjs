'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

export function MobileHeader() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let lastY = window.scrollY
    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        if (y > lastY) {
          el!.style.transform = 'translateY(-100%)'
          el!.style.opacity = '0'
        } else {
          el!.style.transform = 'translateY(0)'
          el!.style.opacity = '1'
        }
        lastY = y <= 0 ? 0 : y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      ref={ref}
      className="md:hidden fixed top-0 z-50 flex items-center justify-between w-full min-h-[64px] px-4 bg-black light:bg-white border-b border-b-white/10 light:border-b-gray-200"
      style={{ transition: 'transform 0.5s, opacity 0.5s' }}
    >
      <Link href="/" className="w-[clamp(180px,40vw,250px)]">
        <Image
          src="/reach_radio_logo.svg"
          alt="Reach Radio"
          width={250}
          height={40}
          className="h-8 w-auto"
          priority
        />
      </Link>
      <div className="flex items-center gap-4">
        <a
          href="https://www.facebook.com/reachradiotucson"
          target="_blank"
          rel="noopener noreferrer"
          title="Facebook"
          className="w-8 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
          aria-label="Reach Radio on Facebook"
        >
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path d="M36.002 18.11a18 18 0 10-20.816 17.891V23.345h-4.567v-5.233h4.571v-3.993c0-4.538 2.688-7.044 6.8-7.044a27.53 27.53 0 014.029.353v4.454h-2.27a2.61 2.61 0 00-2.931 2.83v3.4h4.984l-.8 5.233h-4.2v12.656a18.081 18.081 0 0015.2-17.891z" fill="inherit" />
          </svg>
        </a>
        <Link
          href="/about#aboutGotQuestions"
          className="flex items-center px-2 py-1 bg-white rounded text-black font-bold text-sm hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          Contact
        </Link>
      </div>
    </header>
  )
}
