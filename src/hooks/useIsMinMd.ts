'use client'

import { useSyncExternalStore } from 'react'

const query = '(min-width: 768px)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(query)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
function getSnapshot() { return window.matchMedia(query).matches }
function getServerSnapshot() { return false }

export function useIsMinMd() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
