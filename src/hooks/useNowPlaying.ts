'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

export function useNowPlaying(): void {
  const setNowPlaying = useMediaStore((s) => s.setNowPlaying)

  useEffect(() => {
    const es = new EventSource('/api/stream-info-sse')

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { title?: string; artist?: string; image?: string }
        const { title, artist, image } = useMediaStore.getState()
        setNowPlaying(
          data.title ?? title,
          data.artist ?? artist,
          data.image ?? image
        )
      } catch {
        // retain existing values on parse error
      }
    }

    return () => es.close()
  }, [setNowPlaying])
}
