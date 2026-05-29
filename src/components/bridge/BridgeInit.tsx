'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { initBridgeProxy } from '@/lib/bridge/proxy'
import { initUnpolyShim } from '@/lib/bridge/compat'
import { postMessageToNative } from '@/lib/bridge/post-message'

interface BridgeInitProps {
  streamUrl?: string
}

function isNativeBridgePresent(): boolean {
  return !!(
    window.Android?.postMessage ||
    window.webkit?.messageHandlers?.messageHandler?.postMessage ||
    window.inNativeApp
  )
}

function setMobileAppCookie() {
  document.cookie = 'mobile-app=true; path=/; max-age=315360000'
}

function clearMobileAppCookie() {
  document.cookie = 'mobile-app=; path=/; max-age=0'
}

export function BridgeInit({ streamUrl }: BridgeInitProps) {
  const router = useRouter()
  const pathname = usePathname()

  // On mount: init bridge, send loaded + streamUrl, wire online/offline
  useEffect(() => {
    initUnpolyShim()
    initBridgeProxy(router)

    postMessageToNative({
      loaded: true,
      ...(streamUrl ? { streamUrl } : {}),
    })

    const handleOnline = () => postMessageToNative({ offline: false })
    const handleOffline = () => postMessageToNative({ offline: true })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router, streamUrl])

  // On route change: send location + showMediaBar state
  useEffect(() => {
    postMessageToNative({ location: pathname })
    postMessageToNative({ showMediaBar: pathname !== '/' })
  }, [pathname])

  // Input focus/blur: hide native nav when keyboard appears, restore after
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      postMessageToNative({ showMobileNav: false, showMediaBar: false })
    }
    function onFocusOut(e: FocusEvent) {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      postMessageToNative({ showMobileNav: true, showMediaBar: pathname !== '/' })
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [pathname])

  // Native app detection: check injected bridge objects first (most reliable),
  // then fall back to verified postMessage. Clear stale cookie if not in native app.
  useEffect(() => {
    if (isNativeBridgePresent()) {
      setMobileAppCookie()
      return
    }

    // If cookie is set but bridge objects are absent, clear it — stale from prior session
    if (document.cookie.includes('mobile-app=true')) {
      clearMobileAppCookie()
    }

    // Fallback: native app may post a message before bridge objects are detectable
    function handleMessage(e: MessageEvent) {
      if (e.origin !== '' && e.origin !== window.location.origin) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (!data || typeof data !== 'object' || !('protocolVersion' in data)) return
      } catch {
        return
      }
      setMobileAppCookie()
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return null
}
