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
}

let mockES: MockEventSource

vi.stubGlobal('EventSource', vi.fn(function (url: string) {
  mockES = new MockEventSource(url)
  return mockES
}))

describe('useNowPlaying', () => {
  beforeEach(() => {
    useMediaStore.setState({
      title: 'Reach Radio',
      artist: '',
      image: 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
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
})
