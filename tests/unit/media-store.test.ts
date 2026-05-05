import { describe, it, expect, beforeEach } from 'vitest'
import { useMediaStore } from '@/lib/store/media-store'

describe('useMediaStore', () => {
  beforeEach(() => {
    useMediaStore.setState({
      isPlaying: false,
      isBuffering: false,
      isMuted: false,
      volume: 100,
      title: 'Reach Radio',
      artist: '',
      image: 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg',
      showMediaBar: false,
    })
  })

  it('setIsPlaying updates isPlaying', () => {
    useMediaStore.getState().setIsPlaying(true)
    expect(useMediaStore.getState().isPlaying).toBe(true)
  })

  it('setIsBuffering updates isBuffering', () => {
    useMediaStore.getState().setIsBuffering(true)
    expect(useMediaStore.getState().isBuffering).toBe(true)
  })

  it('setNowPlaying updates title, artist, image', () => {
    useMediaStore.getState().setNowPlaying('Test Title', 'Test Artist', 'https://example.com/img.jpg')
    const { title, artist, image } = useMediaStore.getState()
    expect(title).toBe('Test Title')
    expect(artist).toBe('Test Artist')
    expect(image).toBe('https://example.com/img.jpg')
  })

  it('setShowMediaBar updates showMediaBar', () => {
    useMediaStore.getState().setShowMediaBar(true)
    expect(useMediaStore.getState().showMediaBar).toBe(true)
  })
})
