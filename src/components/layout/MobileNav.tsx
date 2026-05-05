'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Listen', icon: 'play' },
  { href: '/about', label: 'About', icon: 'info' },
  { href: '/donate', label: 'Donate', icon: 'heart' },
  { href: '/teachers', label: 'Teachers', icon: 'people' },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav id="site-nav" className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-brand-purple)] border-t border-white/10 flex justify-around py-2 z-40">
      {navItems.map((item) => {
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 text-xs px-4 py-3 ${isActive ? 'text-white' : 'text-white/80'}`}
          >
            <span className="text-lg">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
