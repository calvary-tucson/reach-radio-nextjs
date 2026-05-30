import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { AudioProvider } from '@/components/AudioProvider'
import { useMediaStore } from '@/lib/store/media-store'

let originalPlay: PropertyDescriptor | undefined
let originalPause: PropertyDescriptor | undefined

// jsdom does not implement HTMLMediaElement.play/pause — stub them
function stubAudioElement() {
  const play = vi.fn().mockResolvedValue(undefined)
  const pause = vi.fn()
  originalPlay = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, 'play')
  originalPause = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, 'pause')
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: play,
  })
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: pause,
  })
  return { play, pause }
}

describe('AudioProvider', () => {
  let play: ReturnType<typeof vi.fn>
  let pause: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset store to known defaults before each test
    useMediaStore.setState({
      isPlaying: false,
      isBuffering: false,
      isMuted: false,
      volume: 100,
      previousVolume: 100,
    })
    ;({ play, pause } = stubAudioElement())
    // Silence useNowPlaying's EventSource — needs constructor form for `new EventSource(...)`
    vi.stubGlobal('EventSource', vi.fn(function MockEventSource() {
      this.onmessage = null
      this.onerror = null
      this.close = vi.fn()
    }))
  })

  afterEach(() => {
    if (originalPlay) {
      Object.defineProperty(window.HTMLMediaElement.prototype, 'play', originalPlay)
    }
    if (originalPause) {
      Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', originalPause)
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders a hidden audio element with the given streamUrl', () => {
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    // <audio> has no ARIA role — RTL role queries can't be used here
    const audio = container.querySelector('audio')
    expect(audio).not.toBeNull()
    expect(audio!.src).toBe('https://stream.example.com/radio')
  })

  it('calls play() when isPlaying becomes true', async () => {
    render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    await act(async () => {
      useMediaStore.getState().setIsPlaying(true)
    })
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('calls pause() when isPlaying becomes false after being true', async () => {
    useMediaStore.setState({ isPlaying: true })
    render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    await act(async () => {
      useMediaStore.getState().setIsPlaying(false)
    })
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('sets isPlaying false when play() rejects (e.g. NotAllowedError)', async () => {
    play.mockRejectedValue(new Error('NotAllowedError'))
    render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    await act(async () => {
      useMediaStore.getState().setIsPlaying(true)
    })
    await vi.waitFor(() => {
      expect(useMediaStore.getState().isPlaying).toBe(false)
    })
  })

  it('syncs volume prop: setVolume(50) → audio.volume = 0.5', () => {
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      useMediaStore.getState().setVolume(50)
    })
    expect(audio.volume).toBeCloseTo(0.5)
  })

  it('syncs muted prop: setMuted(true) → audio.muted = true', () => {
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      useMediaStore.getState().setMuted(true)
    })
    expect(audio.muted).toBe(true)
  })

  it('onLoadStart fires setIsBuffering(true)', () => {
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      audio.dispatchEvent(new Event('loadstart'))
    })
    expect(useMediaStore.getState().isBuffering).toBe(true)
  })

  it('onPlaying fires setIsBuffering(false)', () => {
    useMediaStore.setState({ isBuffering: true })
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      audio.dispatchEvent(new Event('playing'))
    })
    expect(useMediaStore.getState().isBuffering).toBe(false)
  })

  it('onError stops playback and clears buffering', () => {
    useMediaStore.setState({ isPlaying: true, isBuffering: true })
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      audio.dispatchEvent(new Event('error'))
    })
    expect(useMediaStore.getState().isPlaying).toBe(false)
    expect(useMediaStore.getState().isBuffering).toBe(false)
  })

  it('onWaiting fires setIsBuffering(true)', () => {
    useMediaStore.setState({ isBuffering: false })
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      audio.dispatchEvent(new Event('waiting'))
    })
    expect(useMediaStore.getState().isBuffering).toBe(true)
  })

  it('onPause fires setIsPlaying(false) and setIsBuffering(false)', () => {
    useMediaStore.setState({ isPlaying: true, isBuffering: true })
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      audio.dispatchEvent(new Event('pause'))
    })
    expect(useMediaStore.getState().isPlaying).toBe(false)
    expect(useMediaStore.getState().isBuffering).toBe(false)
  })
})
