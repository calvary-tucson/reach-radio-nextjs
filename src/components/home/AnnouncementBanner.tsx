'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Calendar, Heart, Info, RadioTower, X, type LucideIcon } from 'lucide-react'
import { BANNER_DISMISSED_PREFIX, isBannerInWindow, type BannerIcon, type SiteBanner } from '@/lib/banners'

interface AnnouncementBannerProps {
  banners: readonly SiteBanner[]
}

const ICONS: Record<BannerIcon, LucideIcon> = {
  'radio-tower': RadioTower,
  info: Info,
  calendar: Calendar,
  heart: Heart,
}

const LINK_CLASS =
  'inline-flex min-h-11 items-center font-medium text-[#84b84f] underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none light:text-green-700'

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readDismissed(id: string): boolean {
  try {
    return localStorage.getItem(BANNER_DISMISSED_PREFIX + id) === '1'
  } catch {
    return false
  }
}

function writeDismissed(id: string) {
  try {
    localStorage.setItem(BANNER_DISMISSED_PREFIX + id, '1')
  } catch {
    // Storage unavailable (private mode): the banner hides for this view only.
  }
  listeners.forEach((l) => l())
}

function todayInPhoenix(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date())
}

/** Id of the first banner in its date window that was not dismissed, or '' for none. */
function activeBannerId(banners: readonly SiteBanner[]): string {
  const today = todayInPhoenix()
  return banners.find((b) => isBannerInWindow(b, today) && !readDismissed(b.id))?.id ?? ''
}

export function AnnouncementBanner({ banners }: AnnouncementBannerProps) {
  // Server snapshot is '' so SSR never flashes a banner at visitors who already dismissed it.
  const activeId = useSyncExternalStore(
    subscribe,
    () => activeBannerId(banners),
    () => '',
  )
  const banner = banners.find((b) => b.id === activeId)
  if (!banner) return null

  const Icon = ICONS[banner.icon ?? 'radio-tower']
  const last = banner.paragraphs.length - 1
  const link = banner.link

  return (
    // data-web-chrome: globals.css hides this inside the native iOS/Android app.
    <div
      data-web-chrome
      role="region"
      aria-label="Station notice"
      className="flex items-start gap-3 rounded-[18px] border border-[#84b84f]/25 bg-[#84b84f]/10 p-4 light:border-green-700/30 light:bg-green-50"
    >
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#84b84f] light:text-green-700" />
      <div className="flex-1 space-y-2 text-sm text-white/90 light:text-gray-900">
        {banner.paragraphs.map((text, i) => (
          <p key={text} className={i === last && last > 0 ? 'font-medium' : undefined}>
            {text}
          </p>
        ))}
        {link &&
          (link.href.startsWith('/') ? (
            <Link href={link.href} className={LINK_CLASS}>
              {link.label}
            </Link>
          ) : (
            <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              {link.label}
            </a>
          ))}
      </div>
      <button
        type="button"
        onClick={() => writeDismissed(banner.id)}
        aria-label="Dismiss notice"
        className="-m-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/60 hover:text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none light:text-gray-600 light:hover:text-gray-900"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  )
}
