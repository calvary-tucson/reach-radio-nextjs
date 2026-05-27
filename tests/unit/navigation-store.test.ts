import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNavigationStore } from '@/lib/stores/navigation-store'

beforeEach(() => {
  useNavigationStore.setState({ navigating: false, title: null })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useNavigationStore', () => {
  it('start sets navigating after 150ms delay', () => {
    useNavigationStore.getState().start('Page')
    expect(useNavigationStore.getState().navigating).toBe(false)
    vi.advanceTimersByTime(150)
    expect(useNavigationStore.getState().navigating).toBe(true)
    expect(useNavigationStore.getState().title).toBe('Page')
  })

  it('reset prevents navigating from showing if called before delay', () => {
    useNavigationStore.getState().start()
    useNavigationStore.getState().reset()
    vi.advanceTimersByTime(200)
    expect(useNavigationStore.getState().navigating).toBe(false)
  })

  it('reset clears navigating when already showing', () => {
    useNavigationStore.getState().start()
    vi.advanceTimersByTime(200)
    expect(useNavigationStore.getState().navigating).toBe(true)
    useNavigationStore.getState().reset()
    expect(useNavigationStore.getState().navigating).toBe(false)
  })
})
