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
      sleepTimerActive: false,
      remainingSleepSeconds: 0,
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

  it('startSleepTimer sets remainingSleepSeconds and sleepTimerActive atomically', () => {
    useMediaStore.getState().startSleepTimer(1800)
    const { remainingSleepSeconds, sleepTimerActive } = useMediaStore.getState()
    expect(remainingSleepSeconds).toBe(1800)
    expect(sleepTimerActive).toBe(true)
  })

  it('startSleepTimer(0) activates timer with 0 seconds', () => {
    useMediaStore.getState().startSleepTimer(0)
    expect(useMediaStore.getState().sleepTimerActive).toBe(true)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(0)
  })

  it('setTeachersList updates teachersList', () => {
    const list = [
      { name: 'Alice', photo: 'https://example.com/alice.jpg' },
      { name: 'Bob', photo: 'https://example.com/bob.jpg' },
    ]
    useMediaStore.getState().setTeachersList(list)
    expect(useMediaStore.getState().teachersList).toEqual(list)
  })
})
