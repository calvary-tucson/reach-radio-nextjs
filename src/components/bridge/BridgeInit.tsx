'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { initBridgeProxy } from '@/lib/bridge/proxy'
import { initUnpolyShim } from '@/lib/bridge/compat'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function BridgeInit() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    initUnpolyShim()
    initBridgeProxy(router)

    const handleOnline = () => postMessageToNative(JSON.stringify({ offline: false }))
    const handleOffline = () => postMessageToNative(JSON.stringify({ offline: true }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router])

  useEffect(() => {
    postMessageToNative(JSON.stringify({ location: pathname }))
  }, [pathname])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // Allow same-origin and null-origin (native WebView postMessage)
      if (e.origin !== '' && e.origin !== window.location.origin) return
      if (!document.cookie.includes('mobile-app=true')) {
        document.cookie = 'mobile-app=true; path=/; max-age=315360000'
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return null
}
