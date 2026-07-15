import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

describe('BridgeInit — forwards media store changes to native', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'inNativeApp', { value: true, configurable: true, writable: true })
  })

  beforeEach(() => {
    useMediaStore.setState({
      title: '',
      artist: '',
      resolvedArtist: null,
      image: '',
      isMuted: false,
      volume: 1,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('posts updated track metadata when title/artist/image change', () => {
    render(<BridgeInit streamUrl="https://stream.example.com" />)
    vi.mocked(postMessageToNative).mockClear()

    act(() => {
      useMediaStore.setState({ title: 'A Show', artist: 'A Teacher', resolvedArtist: 'A Teacher', image: '/a.jpg' })
    })

    expect(postMessageToNative).toHaveBeenCalledWith({
      title: 'A Show',
      artist: 'A Teacher',
      resolvedArtist: 'A Teacher',
      image: '/a.jpg',
    })
  })

  it('posts updated mute/volume when they change', () => {
    render(<BridgeInit streamUrl="https://stream.example.com" />)
    vi.mocked(postMessageToNative).mockClear()

    act(() => {
      useMediaStore.setState({ isMuted: true, volume: 0.5 })
    })

    expect(postMessageToNative).toHaveBeenCalledWith({ isMuted: true, volume: 0.5 })
  })
})
