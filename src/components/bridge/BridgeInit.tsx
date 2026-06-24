'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { useMediaStore } from '@/lib/store/media-store'

interface BridgeInitProps {
  streamUrl?: string
}

type NativeCommand =
  | { type: 'navigate'; path: string }
  | { type: 'refresh' }
  | { type: 'setPlayState'; playing: boolean }
  | { type: 'setBuffering'; buffering: boolean }

declare global {
  interface WindowEventMap {
    nativeCommand: CustomEvent<NativeCommand>
  }
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
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const image = useMediaStore((s) => s.image)

  // Native bridge: receive commands from iOS/Android via CustomEvent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!window.inNativeApp) return

    const handler = (e: CustomEvent<NativeCommand>) => {
      const cmd = e.detail
      switch (cmd.type) {
        case 'navigate': router.push(cmd.path); break
        case 'refresh': router.refresh(); break
        case 'setPlayState': useMediaStore.getState().setIsPlaying(cmd.playing); break
        case 'setBuffering': useMediaStore.getState().setIsBuffering(cmd.buffering); break
      }
    }
    window.addEventListener('nativeCommand', handler)

    // loaded: true AFTER listener attached — iOS isBridgeReady gates on this
    postMessageToNative({ loaded: true, streamUrl })

    // V3 shims — remove when v3 iOS retires from App Store
    ;(window as any).up = {
      navigate: ({ url }: { url: string }) => router.push(url),
      reload: () => router.refresh(),
      history: { get location() { return pathname } }
    }
    ;(window as any).globalState = {
      mediaBarState: {
        isPlaying: { set: (v: boolean) => useMediaStore.getState().setIsPlaying(v) },
        isBuffering: { set: (v: boolean) => useMediaStore.getState().setIsBuffering(v) }
      }
    }

    return () => window.removeEventListener('nativeCommand', handler)
  }, [])

  // Online/offline → notify native
  useEffect(() => {
    const handleOnline = () => postMessageToNative({ offline: false })
    const handleOffline = () => postMessageToNative({ offline: true })
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // On route change: send location + showMediaBar + nav visibility + reset zoom
  useEffect(() => {
    // Reset any pinch-zoom carried over from the previous page
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    let t: ReturnType<typeof setTimeout> | undefined
    if (meta) {
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
      t = setTimeout(() => {
        meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover'
      }, 50)
    }

    const segments = pathname.split('/').filter(Boolean)
    const isTeacherDetail =
      segments[0] === 'teachers' && segments.length === 2 && segments[1] !== 'search'
    postMessageToNative({ location: pathname })
    postMessageToNative({ showMediaBar: pathname !== '/' && !isTeacherDetail })
    postMessageToNative({ showMobileNav: !isTeacherDetail })

    return () => clearTimeout(t)
  }, [pathname])

  // Forward track metadata to native whenever it changes in the store
  useEffect(() => {
    postMessageToNative({ title, artist, image })
  }, [title, artist, image])

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
