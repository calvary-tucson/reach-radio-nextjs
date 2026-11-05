import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useMediaStore } from '@/lib/store/media-store'
import { useTeachersStore } from '@/lib/store/teachers-store'
import { DEFAULT_TITLE, FALLBACK_OG_IMAGE, NOW_PLAYING_SSE_URL } from '@/lib/constants'

class MockEventSource {
  static OPEN = 1
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  listeners: Record<string, (e: { data: string }) => void> = {}
  constructor(public url: string) {}
  addEventListener(type: string, fn: (e: { data: string }) => void) {
    this.listeners[type] = fn
  }
  simulateMessage(data: string) {
    this.onmessage?.({ data })
  }
  simulateNamedEvent(type: string, data: string) {
    this.listeners[type]?.({ data })
  }
  simulateError() {
    this.onerror?.()
  }
}

let mockES: MockEventSource

describe('useNowPlaying', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', vi.fn(function (url: string) {
      mockES = new MockEventSource(url)
      return mockES
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }))
    useMediaStore.setState({
      title: 'Reach Radio',
      artist: '',
      image: 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg',
    })
    useTeachersStore.setState({ teachersList: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('connects to the Cloudflare SSE endpoint, not the Vercel route', () => {
    renderHook(() => useNowPlaying())
    expect(mockES.url).toBe(NOW_PLAYING_SSE_URL)
    expect(mockES.url).toMatch(/^https:\/\/reach-radio-web\.pages\.dev\//)
  })

  it('updates store when SSE message arrives', () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateMessage(JSON.stringify({ title: 'Test Show', artist: 'John Doe', image: 'https://cdn.sanity.io/img.jpg' }))
    })

    const { title, artist } = useMediaStore.getState()
    expect(title).toBe('Test Show')
    expect(artist).toBe('John Doe')
  })

  it('updates store from named time-update events (Cloudflare endpoint format)', () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateNamedEvent('time-update', JSON.stringify({ title: 'CF Show', artist: 'Jane Roe' }))
    })

    expect(useMediaStore.getState().title).toBe('CF Show')
    expect(useMediaStore.getState().artist).toBe('Jane Roe')
  })

  it('retains existing values on malformed SSE message', () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateMessage('not-json')
    })

    expect(useMediaStore.getState().title).toBe('Reach Radio')
  })

  it('closes connection on error then retries after delay', async () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateError()
    })

    // Error handler closes the current connection immediately before scheduling retry
    expect(mockES.close).toHaveBeenCalledTimes(1)

    // Advance past the 1s + up to 500ms jitter retry delay — a new EventSource is created
    act(() => {
      vi.advanceTimersByTime(1600)
    })

    expect(EventSource).toHaveBeenCalledTimes(2)
  })

  it('does not reconnect within remaining backoff window after exhausting short delays', async () => {
    renderHook(() => useNowPlaying())
    const EventSourceSpy = vi.mocked(EventSource)

    // Exhaust 5 retries (delays: 1s, 2s, 4s, 8s, 16s = 31s total)
    for (let i = 0; i < 5; i++) {
      act(() => { mockES.simulateError() })
      act(() => { vi.advanceTimersByTime(32_000) })
    }

    const callsAfterExhaustion = EventSourceSpy.mock.calls.length

    // One more error after exhaustion should not create new EventSource within 32s
    // (60s cap not yet elapsed)
    act(() => { mockES.simulateError() })
    act(() => { vi.advanceTimersByTime(32_000) })

    expect(EventSourceSpy.mock.calls.length).toBe(callsAfterExhaustion)
  })

  describe('payload validation', () => {
    it('ignores a non-string title and keeps the previous value', () => {
      renderHook(() => useNowPlaying())
      act(() => {
        mockES.simulateNamedEvent('time-update', JSON.stringify({ title: { x: 1 }, artist: 'Jane Roe' }))
      })
      expect(useMediaStore.getState().title).toBe('Reach Radio')
      expect(useMediaStore.getState().artist).toBe('Jane Roe')
    })

    it('ignores a non-string artist and keeps the previous value', () => {
      renderHook(() => useNowPlaying())
      act(() => {
        mockES.simulateNamedEvent('time-update', JSON.stringify({ title: 'Show', artist: 42 }))
      })
      expect(useMediaStore.getState().title).toBe('Show')
      expect(useMediaStore.getState().artist).toBe('')
    })

    it('maps the Cloudflare fallback title "Reach Radio FM" to the store default', () => {
      useMediaStore.setState({ title: 'Some Show' })
      renderHook(() => useNowPlaying())
      act(() => {
        mockES.simulateNamedEvent('time-update', JSON.stringify({ title: 'Reach Radio FM', artist: '' }))
      })
      expect(useMediaStore.getState().title).toBe(DEFAULT_TITLE)
      expect(DEFAULT_TITLE).toBe('Reach Radio')
    })

    it('caps title and artist at 200 characters', () => {
      renderHook(() => useNowPlaying())
      act(() => {
        mockES.simulateNamedEvent('time-update', JSON.stringify({ title: 'a'.repeat(500), artist: 'b'.repeat(500) }))
      })
      expect(useMediaStore.getState().title).toHaveLength(200)
      expect(useMediaStore.getState().artist).toHaveLength(200)
    })

    it('ignores imageUrl from a disallowed host and falls back to client match', () => {
      useTeachersStore.setState({ teachersList: [{ name: 'John Doe', photo: 'https://cdn.sanity.io/teacher.jpg' }] })
      renderHook(() => useNowPlaying())
      act(() => {
        mockES.simulateMessage(JSON.stringify({
          title: 'Show', artist: 'John Doe', imageUrl: 'https://evil.example/x.jpg', resolvedArtist: 'John Doe',
        }))
      })
      expect(useMediaStore.getState().image).toContain('cdn.sanity.io/teacher.jpg')
    })

    it('accepts server-resolved imageUrl on the Sanity CDN', () => {
      renderHook(() => useNowPlaying())
      act(() => {
        mockES.simulateMessage(JSON.stringify({
          title: 'Show', artist: 'John Doe', imageUrl: 'https://cdn.sanity.io/srv.jpg', resolvedArtist: 'John Doe',
        }))
      })
      expect(useMediaStore.getState().image).toBe('https://cdn.sanity.io/srv.jpg')
      expect(useMediaStore.getState().resolvedArtist).toBe('John Doe')
    })

    it('does not drop the title update when a matched teacher has a null photo', () => {
      useTeachersStore.setState({
        teachersList: [{ name: 'John Doe', photo: null as unknown as string }],
      })
      renderHook(() => useNowPlaying())
      act(() => {
        mockES.simulateNamedEvent('time-update', JSON.stringify({ title: 'Show', artist: 'John Doe' }))
      })
      expect(useMediaStore.getState().title).toBe('Show')
      expect(useMediaStore.getState().image).toBe(FALLBACK_OG_IMAGE)
      expect(useMediaStore.getState().resolvedArtist).toBe('John Doe')
    })
  })

  describe('teacher photo resolution', () => {
    it('resolves image on exact name match', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ name: 'John Doe', photo: 'https://cdn.sanity.io/teacher.jpg' }]),
      } as Response)

      renderHook(() => useNowPlaying())

      await act(async () => { await Promise.resolve() })

      act(() => {
        mockES.simulateMessage(JSON.stringify({ title: 'Test Show', artist: 'John Doe' }))
      })

      const { image, artist } = useMediaStore.getState()
      expect(image).toContain('cdn.sanity.io/teacher.jpg')
      expect(artist).toBe('John Doe')
    })

    it('resolves image on partial name match', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ name: 'John Doe', photo: 'https://cdn.sanity.io/teacher.jpg' }]),
      } as Response)

      renderHook(() => useNowPlaying())

      await act(async () => { await Promise.resolve() })

      act(() => {
        mockES.simulateMessage(JSON.stringify({ title: 'Test Show', artist: 'Pastor John Doe' }))
      })

      expect(useMediaStore.getState().image).toContain('cdn.sanity.io/teacher.jpg')
    })

    it('falls back to FALLBACK_OG_IMAGE when no teacher match', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ name: 'Jane Smith', photo: 'https://cdn.sanity.io/jane.jpg' }]),
      } as Response)

      renderHook(() => useNowPlaying())

      await act(async () => { await Promise.resolve() })

      act(() => {
        mockES.simulateMessage(JSON.stringify({ title: 'Test Show', artist: 'Unknown Artist' }))
      })

      expect(useMediaStore.getState().image).toBe(FALLBACK_OG_IMAGE)
    })

    it('re-resolves the teacher when the list loads after the first event', () => {
      renderHook(() => useNowPlaying())

      act(() => {
        mockES.simulateNamedEvent('time-update', JSON.stringify({ title: 'Show', artist: 'John Doe' }))
      })
      expect(useMediaStore.getState().image).toBe(FALLBACK_OG_IMAGE)
      expect(useMediaStore.getState().resolvedArtist).toBeNull()

      act(() => {
        useTeachersStore.getState().setTeachersList([
          { name: 'John Doe', photo: 'https://cdn.sanity.io/teacher.jpg' },
        ])
      })

      expect(useMediaStore.getState().image).toContain('cdn.sanity.io/teacher.jpg')
      expect(useMediaStore.getState().resolvedArtist).toBe('John Doe')
      expect(useMediaStore.getState().title).toBe('Show')
    })

    it('stops re-resolving after unmount', () => {
      const { unmount } = renderHook(() => useNowPlaying())
      act(() => {
        mockES.simulateNamedEvent('time-update', JSON.stringify({ title: 'Show', artist: 'John Doe' }))
      })
      unmount()
      act(() => {
        useTeachersStore.getState().setTeachersList([
          { name: 'John Doe', photo: 'https://cdn.sanity.io/teacher.jpg' },
        ])
      })
      expect(useMediaStore.getState().image).toBe(FALLBACK_OG_IMAGE)
    })

    it('uses FALLBACK_OG_IMAGE when teacher fetch fails', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      renderHook(() => useNowPlaying())

      await act(async () => { await Promise.resolve() })

      act(() => {
        mockES.simulateMessage(JSON.stringify({ title: 'Test Show', artist: 'John Doe' }))
      })

      expect(useMediaStore.getState().image).toBe(FALLBACK_OG_IMAGE)
    })
  })
})
