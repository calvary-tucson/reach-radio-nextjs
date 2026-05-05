'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

const MAX_RETRIES = 5

export function useNowPlaying(): void {
  const setNowPlaying = useMediaStore((s) => s.setNowPlaying)

  useEffect(() => {
    let retries = 0
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (es) es.close()
      es = new EventSource('/api/stream-info-sse')

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { title?: string; artist?: string; image?: string }
          const { title, artist, image } = useMediaStore.getState()
          setNowPlaying(
            data.title ?? title,
            data.artist ?? artist,
            data.image ?? image
          )
          retries = 0
        } catch {
          // retain existing values on parse error
        }
      }

      es.onerror = () => {
        if (retries >= MAX_RETRIES) return
        const delay = Math.pow(2, retries) * 1000
        retries++
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (es) es.close()
    }
  }, [setNowPlaying])
}
