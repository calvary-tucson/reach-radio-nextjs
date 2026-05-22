'use client'

import { useSyncExternalStore } from 'react'

const mobileQuery = '(max-width: 639px)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(mobileQuery)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
function getSnapshot() { return window.matchMedia(mobileQuery).matches }
function getServerSnapshot() { return false }

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
