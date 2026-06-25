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
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `mobile-app=true; path=/; max-age=31536000; SameSite=Lax${secure}`
}

function clearMobileAppCookie() {
  document.cookie = 'mobile-app=; path=/; max-age=0; SameSite=Lax'
}

function isTeacherDetailPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  return segments[0] === 'teachers' && segments.length === 2 && segments[1] !== 'search'
}

export function BridgeInit({ streamUrl }: BridgeInitProps) {
  const router = useRouter()
  const pathname = usePathname()
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const image = useMediaStore((s) => s.image)

  // Native bridge: receive commands from iOS/Android via CustomEvent
  // Fix: gate on isNativeBridgePresent() (both platforms) not window.inNativeApp (iOS only)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge must initialize exactly once; router is stable and adding it causes re-runs on every navigation
  useEffect(() => {
    if (!isNativeBridgePresent()) return

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

    // Primary navigation API — both platforms call these for bottom nav tabs and back button
    window.globalActions = {
      goToPage: (path: string) => router.push(path),
      goBack: () => window.history.back(),
    }

    // V3 shims — remove when v3 iOS retires from App Store
    window.up = {
      navigate: ({ url }: { url: string }) => router.push(url),
      reload: () => router.refresh(),
      // Fix: live read of window.location.pathname, not stale closure over mount-time pathname
      history: { get location() { return window.location.pathname } },
    }

    // Android play state sync — isMuted and showMediaBar added to match Android bridge contracts
    window.globalState = {
      mediaBarState: {
        isPlaying: { set: (v: boolean) => useMediaStore.getState().setIsPlaying(v) },
        isBuffering: { set: (v: boolean) => useMediaStore.getState().setIsBuffering(v) },
        isMuted: { set: (v: boolean) => useMediaStore.getState().setMuted(v) },
        showMediaBar: { set: (v: boolean) => useMediaStore.getState().setShowMediaBar(v) },
      },
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

  // On route change: send location + showMediaBar + nav visibility
  useEffect(() => {
    const isDetail = isTeacherDetailPath(pathname)
    postMessageToNative({ location: pathname })
    postMessageToNative({ showMediaBar: pathname !== '/' && !isDetail })
    postMessageToNative({ showMobileNav: !isDetail })
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
      // Fix: include isTeacherDetail check to match route-change logic
      const isDetail = isTeacherDetailPath(pathname)
      postMessageToNative({ showMobileNav: !isDetail, showMediaBar: pathname !== '/' && !isDetail })
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [pathname])

  // Native app detection: check injected bridge objects (most reliable),
  // then clear stale cookie if bridge absent. PostMessage fallback for future native versions.
  useEffect(() => {
    if (isNativeBridgePresent()) {
      setMobileAppCookie()
      return
    }

    if (document.cookie.split(';').some(c => c.trim() === 'mobile-app=true')) {
      clearMobileAppCookie()
    }

    // Fix: reject null-origin (e.origin === '') — sandboxed iframes (MinistryForms) could
    // otherwise trigger setMobileAppCookie() and put browser users into native mode
    function handleMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
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
