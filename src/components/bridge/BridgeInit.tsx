'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { useMediaStore } from '@/lib/store/media-store'

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
  document.cookie = 'mobile-app=true; path=/; max-age=31536000; SameSite=Lax'
}

function clearMobileAppCookie() {
  document.cookie = 'mobile-app=; path=/; max-age=0; SameSite=Lax'
}

export function BridgeInit({ streamUrl }: BridgeInitProps) {
  const router = useRouter()
  const pathname = usePathname()

  // One-time setup (re-runs on route change to keep getLocation closure current)
  useEffect(() => {
    window.nativeBridge = {
      navigate: (path: string) => router.push(path),
      refresh: () => router.refresh(),
      getLocation: () => pathname,
      setPlayState: (playing: boolean) => useMediaStore.getState().setIsPlaying(playing),
      setBuffering: (buffering: boolean) => useMediaStore.getState().setIsBuffering(buffering),
    }

    const handleOnline = () => postMessageToNative({ offline: false })
    const handleOffline = () => postMessageToNative({ offline: true })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router, pathname])

  // Send loaded + streamUrl after mount (streamUrl is a static server prop)
  useEffect(() => {
    postMessageToNative({
      loaded: true,
      ...(streamUrl ? { streamUrl } : {}),
    })
  }, [streamUrl])

  // On route change: send location + showMediaBar + restore native nav bar
  useEffect(() => {
    postMessageToNative({ location: pathname })
    postMessageToNative({ showMediaBar: pathname !== '/' })
    postMessageToNative({ showMobileNav: true })
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
    if (document.cookie.split(';').some(c => c.trim() === 'mobile-app=true')) {
      clearMobileAppCookie()
    }

    // Fallback: future native app versions may send a protocolVersion handshake via postMessage
    // before bridge objects are injected. Current iOS/Android builds call JS APIs via
    // evaluateJavaScript only and never postMessage here, so this is forward-compatible only.
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
