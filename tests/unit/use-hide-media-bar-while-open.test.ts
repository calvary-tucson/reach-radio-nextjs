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
    useMediaStore.setState({ showMediaBar: false, openStandaloneSheetCount: 0 })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('restores the captured showMediaBar value on close, even when it diverges from the pathname-derived value', () => {
    // Pathname-derivation for '/' would produce false, but the store was
    // legitimately set true by something else (e.g. RadioPlayer's scroll
    // observer on the home page) before the sheet opened — the restore must
    // replay that captured value, not recompute from pathname.
    mockPathname = '/'
    useMediaStore.setState({ showMediaBar: true })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    expect(useMediaStore.getState().showMediaBar).toBe(false)
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(true)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: true, showMediaBar: true })
  })

  it('restores false when the captured value was false, regardless of pathname', () => {
    mockPathname = '/teachers/search'
    useMediaStore.setState({ showMediaBar: false })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(false)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: true, showMediaBar: false })
  })

  it('derives showMobileNav from the current pathname on close, independent of the captured showMediaBar value', () => {
    mockPathname = '/teachers/john-macarthur'
    useMediaStore.setState({ showMediaBar: true })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(true)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: false, showMediaBar: true })
  })

  it('increments openStandaloneSheetCount while open and decrements it back to 0 on close', () => {
    mockPathname = '/about'
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    expect(useMediaStore.getState().openStandaloneSheetCount).toBe(0)
    rerender({ open: true })
    expect(useMediaStore.getState().openStandaloneSheetCount).toBe(1)
    rerender({ open: false })
    expect(useMediaStore.getState().openStandaloneSheetCount).toBe(0)
  })
})
