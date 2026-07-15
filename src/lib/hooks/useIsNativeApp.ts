'use client'

import { useSyncExternalStore } from 'react'

function subscribe() {
  return () => {}
}

function getSnapshot() {
  return document.documentElement.classList.contains('native-app')
}

function getServerSnapshot() {
  return false
}

export function useIsNativeApp() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
