import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useMediaStore } from '@/lib/store/media-store'

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

vi.stubGlobal('EventSource', vi.fn(function (url: string) {
  mockES = new MockEventSource(url)
  return mockES
}))

describe('useNowPlaying', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useMediaStore.setState({
      title: 'Reach Radio',
      artist: '',
      image: 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
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

  it('does not close permanently on first error — retries after delay', async () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateError()
    })

    // After first error, close is NOT called immediately — retry is scheduled
    expect(mockES.close).not.toHaveBeenCalled()

    // Advance past the 1s retry delay — a new EventSource is created
    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(EventSource).toHaveBeenCalledTimes(2)
  })

  it('closes permanently after max retries exhausted', async () => {
    renderHook(() => useNowPlaying())
    const EventSourceSpy = vi.mocked(EventSource)

    // Exhaust 5 retries (delays: 1s, 2s, 4s, 8s, 16s = 31s total)
    for (let i = 0; i < 5; i++) {
      act(() => { mockES.simulateError() })
      act(() => { vi.advanceTimersByTime(32_000) })
    }

    const callsAfterExhaustion = EventSourceSpy.mock.calls.length

    // One more error after exhaustion should not create new EventSource
    act(() => { mockES.simulateError() })
    act(() => { vi.advanceTimersByTime(32_000) })

    expect(EventSourceSpy.mock.calls.length).toBe(callsAfterExhaustion)
  })
})
