'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { useTeachersStore } from '@/lib/store/teachers-store'
import type { TeacherListEntry } from '@/lib/store/teachers-store'
import {
  CLOUDFLARE_FALLBACK_TITLE,
  DEFAULT_TITLE,
  FALLBACK_OG_IMAGE,
  NOW_PLAYING_SSE_URL,
} from '@/lib/constants'

const MAX_BACKOFF_MS = 60_000
const STABLE_CONNECTION_MS = 10_000
const MAX_TEXT_LEN = 200
const ALLOWED_IMAGE_PREFIX = 'https://cdn.sanity.io/'

interface ParsedPayload {
  title?: string
  artist?: string
  imageUrl?: string | null
  resolvedArtist?: string | null
}

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
    let last: ParsedPayload | null = null
    let stableTimer: ReturnType<typeof setTimeout> | null = null

    function clearStableTimer() {
      if (stableTimer) clearTimeout(stableTimer)
      stableTimer = null
    }

    // Resolve photo/name for the last payload against the current teachers list
    // and push to the store only when something changed.
    function applyLast() {
      if (!last) return
      const { teachersList } = useTeachersStore.getState()
      const current = useMediaStore.getState()

      const rawArtist = last.artist ?? current.artist
      const title = last.title ?? current.title
      let image = FALLBACK_OG_IMAGE
      let resolvedArtist: string | null = null

      if (last.imageUrl && last.resolvedArtist) {
        // Server resolved both — use directly, skip redundant client match
        image = last.imageUrl
        resolvedArtist = last.resolvedArtist
      } else if (rawArtist && teachersList.length > 0) {
        // Client-side match (Cloudflare payload has no imageUrl/resolvedArtist)
        const match = teachersList.find((t) =>
          t.name.toLowerCase().includes(rawArtist.toLowerCase()) ||
          rawArtist.toLowerCase().includes(t.name.toLowerCase())
        )
        if (match) {
          // A teacher without a photo keeps the fallback image but still resolves the name
          if (match.photo) {
            image = match.photo.includes('?')
              ? `${match.photo}&w=420&fm=jpg`
              : `${match.photo}?w=420&fm=jpg`
          }
          resolvedArtist = match.name
        }
      }

      if (
        title === current.title &&
        rawArtist === current.artist &&
        resolvedArtist === current.resolvedArtist &&
        image === current.image
      ) return
      setNowPlaying(title, rawArtist, resolvedArtist, image)
    }

    // Teachers list often loads after the first SSE event: re-resolve then
    const unsubscribeTeachers = useTeachersStore.subscribe((state, prev) => {
      if (state.teachersList !== prev.teachersList) applyLast()
    })

    function connect() {
      if (destroyed) return
      if (es) es.close()
      clearStableTimer()
      es = new EventSource(NOW_PLAYING_SSE_URL)

      // Typed as Event so the same handler fits both onmessage and addEventListener
      const handleMessage = (event: Event) => {
        try {
          const payload = (event as MessageEvent).data
          if (typeof payload !== 'string') return
          const raw: unknown = JSON.parse(payload)
          if (typeof raw !== 'object' || raw === null) return
          const data = raw as Record<string, unknown>

          // Server-resolved pair is accepted only when both are strings and the
          // image is on the Sanity CDN; otherwise fall through to the client match.
          const serverResolved =
            typeof data.imageUrl === 'string' &&
            typeof data.resolvedArtist === 'string' &&
            data.imageUrl.startsWith(ALLOWED_IMAGE_PREFIX)

          last = {
            title:
              typeof data.title === 'string'
                ? data.title === CLOUDFLARE_FALLBACK_TITLE
                  ? DEFAULT_TITLE
                  : data.title.slice(0, MAX_TEXT_LEN)
                : undefined,
            artist: typeof data.artist === 'string' ? data.artist.slice(0, MAX_TEXT_LEN) : undefined,
            imageUrl: serverResolved ? (data.imageUrl as string) : null,
            resolvedArtist: serverResolved ? (data.resolvedArtist as string) : null,
          }
          applyLast()
        } catch {
          // retain existing values on parse error
        }
      }

      // The Cloudflare endpoint emits named `time-update` events. Unnamed events
      // (the legacy Vercel route used by iOS v4 / stale tabs, or format drift)
      // are still accepted via onmessage.
      es.onmessage = handleMessage
      es.addEventListener('time-update', handleMessage)

      // Backoff resets only after the connection has stayed open long enough,
      // so a server that sends one message then closes cannot cause a tight loop.
      es.onopen = () => {
        clearStableTimer()
        stableTimer = setTimeout(() => { retries = 0 }, STABLE_CONNECTION_MS)
      }

      es.onerror = () => {
        clearStableTimer()
        es?.close()
        if (destroyed) return
        // Exponential backoff capped at 60s — no hard stop
        const delay = Math.min(Math.pow(2, retries) * 1000 + Math.random() * 2000, MAX_BACKOFF_MS)
        retries++
        retryTimer = setTimeout(connect, delay)
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        // Disconnect when tab is hidden — saves server slots
        if (retryTimer) clearTimeout(retryTimer)
        clearStableTimer()
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
      unsubscribeTeachers()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (retryTimer) clearTimeout(retryTimer)
      clearStableTimer()
      if (es) es.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setNowPlaying/setTeachersList are stable Zustand actions; SSE connects once on mount
  }, [])
}
