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

  // Native app detection fallback: set cookie when any native message arrives
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
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
