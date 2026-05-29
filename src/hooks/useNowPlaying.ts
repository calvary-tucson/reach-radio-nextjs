'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

const MAX_RETRIES = 5
const DEFAULT_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

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
    let retries = 0
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
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
        if (retries >= MAX_RETRIES) return
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 500
        retries++
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (es) es.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
