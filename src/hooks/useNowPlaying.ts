'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

const DEFAULT_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'
const MAX_BACKOFF_MS = 60_000

function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    window.Android?.postMessage ||
    window.webkit?.messageHandlers?.messageHandler?.postMessage ||
    window.inNativeApp
  )
}

export function useNowPlaying(): void {
  const setNowPlaying = useMediaStore((s) => s.setNowPlaying)
  const setTeachersList = useMediaStore((s) => s.setTeachersList)

  // Fetch teacher list once — used to resolve artist → photo
  useEffect(() => {
    fetch('/api/teachers-list')
      .then((r) => r.json())
      .then((data: { name: string; photo: string }[]) => {
        setTeachersList(data)
      })
      .catch(() => {
        // non-critical, best-effort
      })
  }, [setTeachersList])

  useEffect(() => {
    // Skip SSE in native WebView — BridgeInit relays metadata from Sanity via the bridge
    if (isNativeApp()) return

    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let retries = 0
    let destroyed = false

    function connect() {
      if (destroyed) return
      if (es) es.close()
      es = new EventSource('/api/stream-info-sse')

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { title?: string; artist?: string }

          const { teachersList } = useMediaStore.getState()

          let image = DEFAULT_IMAGE
          let resolvedArtist = data.artist ?? useMediaStore.getState().artist

          if (resolvedArtist && teachersList.length > 0) {
            const match = teachersList.find((t) =>
              t.name.toLowerCase().includes(resolvedArtist.toLowerCase()) ||
              resolvedArtist.toLowerCase().includes(t.name.toLowerCase())
            )
            if (match) {
              image = match.photo + '?w=420&fm=webp'
              resolvedArtist = match.name
            }
          }

          setNowPlaying(
            data.title ?? useMediaStore.getState().title,
            resolvedArtist,
            image
          )
          retries = 0
        } catch {
          // retain existing values on parse error
        }
      }

      es.onerror = () => {
        es?.close()
        if (destroyed) return
        // Exponential backoff capped at 60s — no hard stop
        const delay = Math.min(Math.pow(2, retries) * 1000 + Math.random() * 500, MAX_BACKOFF_MS)
        retries++
        retryTimer = setTimeout(connect, delay)
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        // Disconnect when tab is hidden — saves server slots
        if (retryTimer) clearTimeout(retryTimer)
        if (es) { es.close(); es = null }
      } else {
        // Reconnect when tab becomes visible
        retries = 0
        connect()
      }
    }

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      destroyed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (retryTimer) clearTimeout(retryTimer)
      if (es) es.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
