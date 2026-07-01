'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { useTeachersStore } from '@/lib/store/teachers-store'
import type { TeacherListEntry } from '@/lib/store/teachers-store'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'

const MAX_BACKOFF_MS = 60_000

export function useNowPlaying(): void {
  const setNowPlaying = useMediaStore((s) => s.setNowPlaying)
  const setTeachersList = useTeachersStore((s) => s.setTeachersList)

  // Fetch teacher list once — used to resolve artist → photo
  useEffect(() => {
    fetch('/api/teachers-list')
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText)
        return r.json()
      })
      .then((data: TeacherListEntry[]) => {
        setTeachersList(data)
      })
      .catch(() => {
        // non-critical, best-effort
      })
  }, [setTeachersList])

  useEffect(() => {
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
          const raw = JSON.parse(event.data)
          if (typeof raw !== 'object' || raw === null) return
          const data = raw as {
            title?: string
            artist?: string
            imageUrl?: string | null
            resolvedArtist?: string | null
          }

          const { teachersList } = useTeachersStore.getState()

          const rawArtist = data.artist ?? useMediaStore.getState().artist
          let image = FALLBACK_OG_IMAGE
          let resolvedArtist: string | null = null

          if (data.imageUrl && data.resolvedArtist) {
            // Server resolved both — use directly, skip redundant client match
            image = data.imageUrl
            resolvedArtist = data.resolvedArtist
          } else if (rawArtist && teachersList.length > 0) {
            // Fallback: client-side match (music gaps, null imageUrl, unmatched artist)
            const match = teachersList.find((t) =>
              t.name.toLowerCase().includes(rawArtist.toLowerCase()) ||
              rawArtist.toLowerCase().includes(t.name.toLowerCase())
            )
            if (match) {
              image = match.photo.includes('?')
                ? `${match.photo}&w=420&fm=jpg`
                : `${match.photo}?w=420&fm=jpg`
              resolvedArtist = match.name
            }
          }

          setNowPlaying(
            data.title ?? useMediaStore.getState().title,
            rawArtist,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setNowPlaying/setTeachersList are stable Zustand actions; SSE connects once on mount
  }, [])
}
