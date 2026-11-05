'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { useTeachersStore } from '@/lib/store/teachers-store'
import type { TeacherListEntry } from '@/lib/store/teachers-store'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'

const POLL_INTERVAL_MS = 30_000
const POLL_JITTER_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000

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
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null
    let failures = 0
    let destroyed = false

    function applyData(raw: unknown) {
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
    }

    function schedule(delay: number) {
      if (destroyed || document.hidden) return
      pollTimer = setTimeout(() => void poll(), delay)
    }

    // Short polls of a CDN-cached endpoint instead of a held-open SSE
    // connection: Vercel bills provisioned memory for every second a request
    // is open, so SSE cost scaled with listener-minutes (see Nov 2026 bill).
    async function poll() {
      if (destroyed) return
      controller = new AbortController()
      try {
        const res = await fetch('/api/stream-info', { signal: controller.signal })
        if (!res.ok) throw new Error(res.statusText)
        const json: unknown = await res.json()
        if (destroyed) return
        applyData(json)
        failures = 0
        schedule(POLL_INTERVAL_MS + Math.random() * POLL_JITTER_MS)
      } catch {
        if (destroyed) return
        failures++
        schedule(Math.min(POLL_INTERVAL_MS * Math.pow(2, failures - 1), MAX_BACKOFF_MS))
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        // Stop polling while the tab is hidden
        if (pollTimer) clearTimeout(pollTimer)
        pollTimer = null
        controller?.abort()
      } else {
        // Refresh immediately when the tab becomes visible
        failures = 0
        if (pollTimer) clearTimeout(pollTimer)
        void poll()
      }
    }

    void poll()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      destroyed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (pollTimer) clearTimeout(pollTimer)
      controller?.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setNowPlaying is a stable Zustand action; polling starts once on mount
  }, [])
}
