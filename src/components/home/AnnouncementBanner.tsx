'use client'

import { useSyncExternalStore } from 'react'
import { RadioTower, X } from 'lucide-react'
import { BANNER_DISMISSED_PREFIX, isBannerExpired, type SiteBanner } from '@/lib/banners'

interface AnnouncementBannerProps {
  banner: SiteBanner
}

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

export function AnnouncementBanner({ banner }: AnnouncementBannerProps) {
  // Server snapshot is "hidden" so SSR never flashes the banner at visitors who already dismissed it.
  const visible = useSyncExternalStore(
    subscribe,
    () => !readDismissed(banner.id) && !isBannerExpired(banner, todayInPhoenix()),
    () => false,
  )

  if (!visible) return null

  const last = banner.paragraphs.length - 1

  return (
    // data-web-chrome: globals.css hides this inside the native iOS/Android app.
    <div
      data-web-chrome
      role="region"
      aria-label="Station notice"
      className="flex items-start gap-3 rounded-[18px] border border-[#84b84f]/25 bg-[#84b84f]/10 p-4 light:border-green-700/30 light:bg-green-50"
    >
      <RadioTower aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#84b84f] light:text-green-700" />
      <div className="flex-1 space-y-2 text-sm text-white/90 light:text-gray-900">
        {banner.paragraphs.map((text, i) => (
          <p key={text} className={i === last && last > 0 ? 'font-medium' : undefined}>
            {text}
          </p>
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
