'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const navItems = [
  { href: '/', label: 'Listen' },
  { href: '/about', label: 'About' },
  { href: '/donate', label: 'Donate' },
  { href: '/teachers', label: 'Teachers' },
]

export function Header() {
  const pathname = usePathname()
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
      id="site-header"
      style={{ viewTransitionName: 'site-header', transition: 'transform 0.5s, opacity 0.5s' }}
      className="hidden md:flex fixed top-0 z-50 w-full h-16 items-center justify-between bg-gray-800 light:bg-white border-b border-b-green-500/20 light:border-b-gray-200 px-6"
    >
      <Link href="/" aria-label="Reach Radio home" className="flex items-center w-[clamp(130px,16vw,186px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded">
        <Image
          src="/reach_radio_logo.svg"
          alt=""
          width={186}
          height={40}
          className="h-10 w-auto"
          priority
        />
      </Link>

      <nav className="flex items-center">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center h-16 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
            >
              {isActive && (
                <>
                  <div className="absolute bottom-0 w-full h-[6px] bg-green-500 rounded-t-md z-10" />
                  <div className="absolute inset-0 -bottom-4 bg-green-500 blur-2xl opacity-60 pointer-events-none" />
                </>
              )}
              <span className={`relative z-10 text-white light:text-gray-900 text-[clamp(14px,1.5vw,16px)] ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-6">
        <a
          href="https://www.facebook.com/reachradiotucson"
          target="_blank"
          rel="noopener noreferrer"
          title="Facebook"
          className="w-7 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
          aria-label="Reach Radio on Facebook"
        >
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path d="M36.002 18.11a18 18 0 10-20.816 17.891V23.345h-4.567v-5.233h4.571v-3.993c0-4.538 2.688-7.044 6.8-7.044a27.53 27.53 0 014.029.353v4.454h-2.27a2.61 2.61 0 00-2.931 2.83v3.4h4.984l-.8 5.233h-4.2v12.656a18.081 18.081 0 0015.2-17.891z" fill="inherit" />
          </svg>
        </a>
        <Link
          href="/about#aboutGotQuestions"
          className="flex items-center px-3 py-1.5 bg-white rounded text-black font-bold text-sm hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          Contact
        </Link>
      </div>
    </header>
  )
}
