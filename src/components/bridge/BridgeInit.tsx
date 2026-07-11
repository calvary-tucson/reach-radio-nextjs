'use client'

import { useEffect, useRef, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { useMediaStore } from '@/lib/store/media-store'
import { useModalStore } from '@/lib/stores/modal'
import { isTeacherDetailPath } from '@/lib/routes'

interface BridgeInitProps {
  streamUrl?: string
}

type NativeCommand =
  | { type: 'navigate'; path: string }
  | { type: 'refresh' }
  | { type: 'setPlayState'; playing: boolean }
  | { type: 'setBuffering'; buffering: boolean }
  | { type: 'prefetchRoutes'; paths: string[] }
  | { type: 'startSleepTimer'; seconds: number }
  | { type: 'pauseSleepTimer' }
  | { type: 'resumeSleepTimer' }
  | { type: 'cancelSleepTimer' }
  | { type: 'setSleepTimer'; seconds: number }
  | { type: 'setViewportInsets'; top: number; bottom: number }

declare global {
  interface WindowEventMap {
    nativeCommand: CustomEvent<NativeCommand>
  }
}

function safeParseJSON(str: string): unknown {
  try { return JSON.parse(str) } catch { return null }
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


export function BridgeInit({ streamUrl }: BridgeInitProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { title, artist, resolvedArtist, image, isMuted, volume } = useMediaStore(
    useShallow((s) => ({
      title: s.title,
      artist: s.artist,
      resolvedArtist: s.resolvedArtist,
      image: s.image,
      isMuted: s.isMuted,
      volume: s.volume,
    }))
  )
  const mediaBarStateBeforeFocus = useRef<boolean | null>(null)
  const [isRefreshPending, startRefreshTransition] = useTransition()
  const wasRefreshPendingRef = useRef(false)

  // Native bridge: receive commands from iOS/Android via CustomEvent
  // Fix: gate on isNativeBridgePresent() (both platforms) not window.inNativeApp (iOS only)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge must initialize exactly once; router is stable and adding it causes re-runs on every navigation; streamUrl intentionally excluded — treated as mount-time constant; native receives it once via the loaded handshake
  useEffect(() => {
    if (!isNativeBridgePresent()) return

    const handler = (e: CustomEvent<NativeCommand>) => {
      // Defensive: native may accidentally JSON.stringify the detail object
      const raw: unknown = typeof e.detail === 'string'
        ? safeParseJSON(e.detail)
        : e.detail
      if (!raw || typeof (raw as { type?: unknown }).type !== 'string') return
      const cmd = raw as NativeCommand
      switch (cmd.type) {
        case 'navigate':
          // Validate path to prevent open redirect via router.push('https://...')
          if (typeof cmd.path !== 'string' || !cmd.path.startsWith('/')) break
          router.push(cmd.path); break
        case 'refresh': startRefreshTransition(() => router.refresh()); break
        case 'setPlayState': useMediaStore.getState().setIsPlaying(cmd.playing); break
        case 'setBuffering': useMediaStore.getState().setIsBuffering(cmd.buffering); break
        case 'prefetchRoutes':
          if (!Array.isArray(cmd.paths)) break
          cmd.paths.forEach(p => typeof p === 'string' && router.prefetch(p)); break
        case 'startSleepTimer':
          if (typeof cmd.seconds !== 'number' || !Number.isFinite(cmd.seconds) || cmd.seconds < 0) break
          useMediaStore.getState().startSleepTimer(cmd.seconds); break
        case 'pauseSleepTimer': useMediaStore.getState().pauseSleepTimer(); break
        case 'resumeSleepTimer': useMediaStore.getState().resumeSleepTimer(); break
        case 'cancelSleepTimer': useMediaStore.getState().cancelSleepTimer(); break
        case 'setSleepTimer':
          if (typeof cmd.seconds !== 'number' || !Number.isFinite(cmd.seconds) || cmd.seconds < 0) break
          useMediaStore.getState().setSleepTimer(cmd.seconds); break
        case 'setViewportInsets':
          if (typeof cmd.bottom === 'number' && Number.isFinite(cmd.bottom) && cmd.bottom >= 0)
            document.documentElement.style.setProperty('--native-bottom-inset', `${Math.round(cmd.bottom)}px`)
          if (typeof cmd.top === 'number' && Number.isFinite(cmd.top) && cmd.top >= 0)
            document.documentElement.style.setProperty('--native-top-inset', `${Math.round(cmd.top)}px`)
          break
        default:
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[BridgeInit] unknown nativeCommand type:', (raw as { type: unknown }).type)
          }
      }
    }
    window.addEventListener('nativeCommand', handler)

    // loaded: true AFTER listener attached — iOS isBridgeReady gates on this
    postMessageToNative({ loaded: true, streamUrl })

    // Pre-warm the teacher search RSC payload + Sanity Data Cache so first open is instant
    router.prefetch('/teachers/search')

    // Primary navigation API — both platforms call these for bottom nav tabs and back button
    window.globalActions = {
      goToPage: (path: string) => router.push(path),
      goBack: () => window.history.back(),
    }

    // V3 shims — remove when v3 iOS retires from App Store
    window.up = {
      navigate: ({ url }: { url: string }) => { if (!url.startsWith('/')) return; router.push(url) },
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

  // native 'refresh' command completion → ack so native ends pull-to-refresh spinner
  useEffect(() => {
    if (wasRefreshPendingRef.current && !isRefreshPending) {
      postMessageToNative({ refreshComplete: true })
    }
    wasRefreshPendingRef.current = isRefreshPending
  }, [isRefreshPending])

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

  // On route change: send location + showMediaBar + nav visibility.
  // Skip the bar fields while a modal sheet is open -- ModalLayout owns bar
  // visibility there (see its isOpen effect), and this computed value would
  // otherwise race it. This matters for /teachers/search specifically:
  // isTeacherDetailPath() deliberately excludes it, so without this guard
  // this effect would send showMediaBar/showMobileNav: true right after
  // ModalLayout hides them, popping the bars back up while the sheet is open.
  useEffect(() => {
    if (useModalStore.getState().isOpen) {
      postMessageToNative({ location: pathname })
      return
    }
    const isDetail = isTeacherDetailPath(pathname)
    postMessageToNative({ location: pathname, showMediaBar: pathname !== '/' && !isDetail, showMobileNav: !isDetail })
  }, [pathname])

  // Forward track metadata to native whenever it changes in the store
  useEffect(() => {
    if (!isNativeBridgePresent()) return
    postMessageToNative({ title, artist, resolvedArtist, image })
  }, [title, artist, resolvedArtist, image])

  // Forward mute/volume to native so AVPlayer can apply them
  useEffect(() => {
    if (!isNativeBridgePresent()) return
    postMessageToNative({ isMuted, volume })
  }, [isMuted, volume])

  // Input focus/blur: hide bars when keyboard appears (native + web), restore after.
  // Skipped while a modal is open — ModalLayout owns bar visibility there, and Radix's
  // focus-scope re-triggers focus/blur on the autofocused input as it manages focus
  // trapping, which would otherwise race this ref-based capture/restore and leave the
  // media bar incorrectly restored to visible mid-sheet.
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      if (useModalStore.getState().isOpen) return
      if (mediaBarStateBeforeFocus.current === null) {
        mediaBarStateBeforeFocus.current = useMediaStore.getState().showMediaBar
      }
      useMediaStore.getState().setShowMediaBar(false)
      postMessageToNative({ showMobileNav: false, showMediaBar: false })
    }
    function onFocusOut(e: FocusEvent) {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      if (useModalStore.getState().isOpen) return
      const restoredMediaBar = mediaBarStateBeforeFocus.current
      if (restoredMediaBar !== null) {
        useMediaStore.getState().setShowMediaBar(restoredMediaBar)
        mediaBarStateBeforeFocus.current = null
      }
      const isDetail = isTeacherDetailPath(pathname)
      const showMediaBar = restoredMediaBar !== null ? restoredMediaBar : (pathname !== '/' && !isDetail)
      postMessageToNative({ showMobileNav: !isDetail, showMediaBar })
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
