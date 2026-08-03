import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useHideMediaBarWhileOpen } from '@/lib/hooks/useHideMediaBarWhileOpen'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

let mockPathname = '/teachers/search'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

describe('useHideMediaBarWhileOpen', () => {
  beforeEach(() => {
    useMediaStore.setState({ showMediaBar: false })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('re-derives showMediaBar=true on close for /teachers/search, not the stale captured false', () => {
    mockPathname = '/teachers/search'
    useMediaStore.setState({ showMediaBar: false })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(true)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: true, showMediaBar: true })
  })

  it('re-derives showMediaBar=false on close for a teacher detail path', () => {
    mockPathname = '/teachers/john-macarthur'
    useMediaStore.setState({ showMediaBar: true })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(false)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: false, showMediaBar: false })
  })

  it('re-derives showMediaBar=false on close for the home page', () => {
    mockPathname = '/'
    useMediaStore.setState({ showMediaBar: true })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(false)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: true, showMediaBar: false })
  })
})
