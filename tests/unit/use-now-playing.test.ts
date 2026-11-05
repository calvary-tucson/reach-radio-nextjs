import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useMediaStore } from '@/lib/store/media-store'
import { useTeachersStore } from '@/lib/store/teachers-store'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'

const NOW_PLAYING_URL = '/api/stream-info'

let nowPlaying: unknown
let nowPlayingOk: boolean
let teachers: unknown

function nowPlayingCalls() {
  return vi.mocked(global.fetch).mock.calls.filter(([u]) => u === NOW_PLAYING_URL).length
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
}

describe('useNowPlaying', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    nowPlaying = { title: 'Reach Radio', artist: '' }
    nowPlayingOk = true
    teachers = []
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === NOW_PLAYING_URL) {
        return Promise.resolve({
          ok: nowPlayingOk,
          statusText: 'err',
          json: () => Promise.resolve(nowPlaying),
        })
      }
      if (teachers instanceof Error) return Promise.reject(teachers)
      return Promise.resolve({ ok: true, json: () => Promise.resolve(teachers) })
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

  it('never opens an EventSource (SSE bills function time per listener)', async () => {
    const es = vi.fn()
    vi.stubGlobal('EventSource', es)
    renderHook(() => useNowPlaying())
    await flush()
    expect(es).not.toHaveBeenCalled()
  })

  it('updates store from the first poll', async () => {
    nowPlaying = { title: 'Test Show', artist: 'John Doe' }
    renderHook(() => useNowPlaying())
    await flush()
    const { title, artist } = useMediaStore.getState()
    expect(title).toBe('Test Show')
    expect(artist).toBe('John Doe')
  })

  it('retains existing values on malformed payload', async () => {
    nowPlaying = 'not-an-object'
    renderHook(() => useNowPlaying())
    await flush()
    expect(useMediaStore.getState().title).toBe('Reach Radio')
  })

  it('polls again after ~30-35s', async () => {
    renderHook(() => useNowPlaying())
    await flush()
    expect(nowPlayingCalls()).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(36_000) })
    expect(nowPlayingCalls()).toBe(2)
  })

  it('backs off exponentially on failure: no retry before 30s, then 60s', async () => {
    nowPlayingOk = false
    renderHook(() => useNowPlaying())
    await flush()
    expect(nowPlayingCalls()).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(29_000) })
    expect(nowPlayingCalls()).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(nowPlayingCalls()).toBe(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(58_000) })
    expect(nowPlayingCalls()).toBe(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(nowPlayingCalls()).toBe(3)
  })

  it('stops polling while tab hidden and refreshes on return', async () => {
    renderHook(() => useNowPlaying())
    await flush()
    const hidden = vi.spyOn(document, 'hidden', 'get')
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(nowPlayingCalls()).toBe(1)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(nowPlayingCalls()).toBe(2)
    hidden.mockRestore()
  })

  it('stops polling after unmount', async () => {
    const { unmount } = renderHook(() => useNowPlaying())
    await flush()
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(nowPlayingCalls()).toBe(1)
  })

  describe('teacher photo resolution', () => {
    async function run(artist: string) {
      nowPlaying = { title: 'Test Show', artist }
      renderHook(() => useNowPlaying())
      await flush()
      // Teacher list loads alongside the first poll; the next poll applies it
      await act(async () => { await vi.advanceTimersByTimeAsync(36_000) })
    }

    it('resolves image on exact name match', async () => {
      teachers = [{ name: 'John Doe', photo: 'https://cdn.sanity.io/teacher.jpg' }]
      await run('John Doe')
      const { image, artist } = useMediaStore.getState()
      expect(image).toContain('cdn.sanity.io/teacher.jpg')
      expect(artist).toBe('John Doe')
    })

    it('resolves image on partial name match', async () => {
      teachers = [{ name: 'John Doe', photo: 'https://cdn.sanity.io/teacher.jpg' }]
      await run('Pastor John Doe')
      expect(useMediaStore.getState().image).toContain('cdn.sanity.io/teacher.jpg')
    })

    it('falls back to FALLBACK_OG_IMAGE when no teacher match', async () => {
      teachers = [{ name: 'Jane Smith', photo: 'https://cdn.sanity.io/jane.jpg' }]
      await run('Unknown Artist')
      expect(useMediaStore.getState().image).toBe(FALLBACK_OG_IMAGE)
    })

    it('uses FALLBACK_OG_IMAGE when teacher fetch fails', async () => {
      teachers = new Error('Network error')
      await run('John Doe')
      expect(useMediaStore.getState().image).toBe(FALLBACK_OG_IMAGE)
    })
  })
})
