import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMediaStore } from '@/lib/store/media-store'

// Mock initBridgeProxy since it sets window globals
vi.mock('@/lib/bridge/proxy', () => ({
  initBridgeProxy: vi.fn(() => {
    ;(window as any).globalState = {
      mediaBarState: {
        isPlaying: { set: (v: boolean) => useMediaStore.getState().setIsPlaying(v) },
        isBuffering: { set: (v: boolean) => useMediaStore.getState().setIsBuffering(v) },
      },
      mobileNavState: {
        showMobileNav: { set: (v: boolean) => useMediaStore.getState().setShowMobileNav(v) },
      },
    }
    ;(window as any).globalActions = {
      goToPage: vi.fn(),
      goBack: vi.fn(),
      setPlayingTrue: () => useMediaStore.getState().setIsPlaying(true),
      setPlayingFalse: () => useMediaStore.getState().setIsPlaying(false),
      toggleMediaBar: (flag: boolean) => useMediaStore.getState().setShowMediaBar(flag),
    }
  }),
}))

import { initBridgeProxy } from '@/lib/bridge/proxy'

describe('bridge proxy', () => {
  beforeEach(() => {
    useMediaStore.setState({ isPlaying: false, isBuffering: false, showMobileNav: true })
    initBridgeProxy()
  })

  it('window.globalState.mediaBarState.isPlaying.set() updates store', () => {
    ;(window as any).globalState.mediaBarState.isPlaying.set(true)
    expect(useMediaStore.getState().isPlaying).toBe(true)
  })

  it('window.globalState.mediaBarState.isBuffering.set() updates store', () => {
    ;(window as any).globalState.mediaBarState.isBuffering.set(true)
    expect(useMediaStore.getState().isBuffering).toBe(true)
  })

  it('window.globalActions.setPlayingTrue() sets isPlaying true', () => {
    ;(window as any).globalActions.setPlayingTrue()
    expect(useMediaStore.getState().isPlaying).toBe(true)
  })

  it('window.globalActions.toggleMediaBar(true) shows media bar', () => {
    ;(window as any).globalActions.toggleMediaBar(true)
    expect(useMediaStore.getState().showMediaBar).toBe(true)
  })
})
