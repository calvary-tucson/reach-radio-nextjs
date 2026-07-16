'use client'

import { useSyncExternalStore } from 'react'

// The 'native-app' class is set once by an inline script in layout.tsx before
// hydration and never changes afterward, so subscribe is a legitimate no-op —
// there's nothing to subscribe to.
function subscribe() {
  return () => {}
}

let cachedSnapshot: boolean | undefined

function getSnapshot() {
  if (cachedSnapshot === undefined) {
    cachedSnapshot = document.documentElement.classList.contains('native-app')
  }
  return cachedSnapshot
}

function getServerSnapshot() {
  return false
}

export function useIsNativeApp() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
