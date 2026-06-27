import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useMediaStore } from '@/lib/store/media-store'
import { useTeachersStore } from '@/lib/store/teachers-store'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'

class MockEventSource {
  static OPEN = 1
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  constructor(public url: string) {}
  simulateMessage(data: string) {
    this.onmessage?.({ data })
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

  it('updates store when SSE message arrives', () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateMessage(JSON.stringify({ title: 'Test Show', artist: 'John Doe', image: 'https://cdn.sanity.io/img.jpg' }))
    })

    const { title, artist } = useMediaStore.getState()
    expect(title).toBe('Test Show')
    expect(artist).toBe('John Doe')
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
