import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { SleepTimerProvider } from '@/components/SleepTimerProvider'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

describe('SleepTimerProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(postMessageToNative).mockClear()
    useMediaStore.setState({
      isPlaying: true,
      sleepTimerActive: false,
      sleepTimerPaused: false,
      remainingSleepSeconds: 0,
      sleepTimerEndsAt: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders null — no DOM output', () => {
    const { container } = render(<SleepTimerProvider />)
    expect(container.firstChild).toBeNull()
  })

  it('does not start interval when timer is inactive', () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    render(<SleepTimerProvider />)
    expect(spy).not.toHaveBeenCalled()
  })

  it('decrements remainingSleepSeconds by 1 each second when active', () => {
    useMediaStore.getState().startSleepTimer(30)
    render(<SleepTimerProvider />)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(28)
  })

  it('stops playback and deactivates timer when countdown reaches 0', () => {
    useMediaStore.getState().startSleepTimer(2)
    render(<SleepTimerProvider />)

    act(() => { vi.advanceTimersByTime(2000) })

    expect(useMediaStore.getState().isPlaying).toBe(false)
    expect(useMediaStore.getState().sleepTimerActive).toBe(false)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(0)
  })

  it('clears interval when sleepTimerActive goes false mid-countdown', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    useMediaStore.getState().startSleepTimer(30)
    render(<SleepTimerProvider />)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

    act(() => { useMediaStore.getState().setSleepTimerActive(false) })

    expect(clearIntervalSpy).toHaveBeenCalledWith(expect.anything())

    // No further decrements after deactivation
    act(() => { vi.advanceTimersByTime(5000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)
  })

  it('clears interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    useMediaStore.getState().startSleepTimer(60)
    const { unmount } = render(<SleepTimerProvider />)
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalledWith(expect.anything())
  })

  it('clears interval when sleepTimerPaused becomes true', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    useMediaStore.getState().startSleepTimer(30)
    render(<SleepTimerProvider />)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

    act(() => { useMediaStore.getState().pauseSleepTimer() })

    expect(clearIntervalSpy).toHaveBeenCalledWith(expect.anything())

    // No decrements while paused
    act(() => { vi.advanceTimersByTime(5000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)
  })

  it('resumes countdown after resumeSleepTimer', () => {
    useMediaStore.getState().startSleepTimer(30)
    render(<SleepTimerProvider />)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

    act(() => { useMediaStore.getState().pauseSleepTimer() })
    act(() => { vi.advanceTimersByTime(3000) })
    // Still 29 while paused
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

    act(() => { useMediaStore.getState().resumeSleepTimer() })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(28)
  })

  it('pushes sleepTimer state to native when timer starts', () => {
    useMediaStore.getState().startSleepTimer(300)
    render(<SleepTimerProvider />)
    const calls = vi.mocked(postMessageToNative).mock.calls
    const sleepTimerCall = calls.find(c => 'sleepTimer' in (c[0] as object))
    expect(sleepTimerCall).toBeDefined()
    const payload = (sleepTimerCall![0] as { sleepTimer: { active: boolean; paused: boolean; endsAt: string | null } }).sleepTimer
    expect(payload.active).toBe(true)
    expect(payload.paused).toBe(false)
    expect(payload.endsAt).not.toBeNull()
  })

  it('pushes sleepTimer state to native when timer pauses', () => {
    useMediaStore.getState().startSleepTimer(300)
    render(<SleepTimerProvider />)
    vi.mocked(postMessageToNative).mockClear()

    act(() => { useMediaStore.getState().pauseSleepTimer() })

    const calls = vi.mocked(postMessageToNative).mock.calls
    const sleepTimerCall = calls.find(c => 'sleepTimer' in (c[0] as object))
    expect(sleepTimerCall).toBeDefined()
    const payload = (sleepTimerCall![0] as { sleepTimer: { active: boolean; paused: boolean; endsAt: string | null } }).sleepTimer
    expect(payload.paused).toBe(true)
    expect(payload.endsAt).toBeNull()
  })

  it('calling startSleepTimer() while already active resets without leaving orphaned intervals', () => {
    useMediaStore.getState().startSleepTimer(30)
    render(<SleepTimerProvider />)

    // Advance 1s — one tick
    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

    // Start a second timer while first is still running
    act(() => { useMediaStore.getState().startSleepTimer(10) })

    // Only one interval should be running — 1 tick = 9s remaining, not 8s
    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(9)
  })
})
