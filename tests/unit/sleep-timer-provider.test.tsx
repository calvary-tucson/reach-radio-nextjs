import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { SleepTimerProvider } from '@/components/SleepTimerProvider'
import { useMediaStore } from '@/lib/store/media-store'

describe('SleepTimerProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useMediaStore.setState({
      isPlaying: true,
      sleepTimerActive: false,
      remainingSleepSeconds: 0,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
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

    expect(clearIntervalSpy).toHaveBeenCalled()

    // No further decrements after deactivation
    act(() => { vi.advanceTimersByTime(5000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)
  })

  it('clears interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    useMediaStore.getState().startSleepTimer(60)
    const { unmount } = render(<SleepTimerProvider />)
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
