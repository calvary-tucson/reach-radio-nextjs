'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useScrollHide } from '@/lib/hooks/useScrollHide'

const navItems = [
  { href: '/', label: 'Listen' },
  { href: '/about', label: 'About' },
  { href: '/donate', label: 'Donate' },
  { href: '/teachers', label: 'Teachers' },
]

export function Header() {
  const pathname = usePathname()
  const ref = useScrollHide<HTMLElement>()

  return (
    <header
      ref={ref}
      id="site-header"
      data-web-chrome=""
      style={{ viewTransitionName: 'site-header' }}
      className="hidden md:flex fixed top-0 z-50 w-full h-16 items-center justify-between bg-gray-800 light:bg-white border-b border-b-green-500/20 light:border-b-gray-200 px-6 will-change-transform"
    >
      <Link href="/" aria-label="Reach Radio home" className="flex items-center w-[clamp(130px,16vw,186px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded">
        <Image
          src="/reach_radio_logo.svg"
          alt=""
          width={248}
          height={58}
          className="h-10 w-auto"
          priority
        />
      </Link>

      <nav aria-label="Primary navigation" className="flex items-center">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center h-16 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
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
          className="w-7 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 motion-safe:transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
          aria-label="Reach Radio on Facebook"
        >
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path d="M36.002 18.11a18 18 0 10-20.816 17.891V23.345h-4.567v-5.233h4.571v-3.993c0-4.538 2.688-7.044 6.8-7.044a27.53 27.53 0 014.029.353v4.454h-2.27a2.61 2.61 0 00-2.931 2.83v3.4h4.984l-.8 5.233h-4.2v12.656a18.081 18.081 0 0015.2-17.891z" fill="inherit" />
          </svg>
        </a>
        <Link
          href="/about#aboutGotQuestions"
          className="flex items-center px-3 py-1.5 bg-white light:border light:border-gray-800 rounded text-black font-bold text-sm hover:bg-gray-100 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Contact
        </Link>
      </div>
    </header>
  )
}
