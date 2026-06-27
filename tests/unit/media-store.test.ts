import { describe, it, expect, beforeEach } from 'vitest'
import { useMediaStore } from '@/lib/store/media-store'

describe('useMediaStore', () => {
  beforeEach(() => {
    useMediaStore.setState({
      isPlaying: false,
      isBuffering: false,
      isMuted: false,
      volume: 100,
      previousVolume: 100,
      title: 'Reach Radio',
      artist: '',
      image: 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg',
      showMediaBar: false,
      sleepTimerActive: false,
      sleepTimerPaused: false,
      remainingSleepSeconds: 0,
      sleepTimerEndsAt: null,
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

  it('startSleepTimer sets sleepTimerPaused=false and endsAt', () => {
    const before = Date.now()
    useMediaStore.getState().startSleepTimer(300)
    const { sleepTimerPaused, sleepTimerEndsAt } = useMediaStore.getState()
    expect(sleepTimerPaused).toBe(false)
    expect(sleepTimerEndsAt).toBeGreaterThanOrEqual(before + 300000 - 50)
    expect(sleepTimerEndsAt).toBeLessThanOrEqual(Date.now() + 300000 + 50)
  })

  it('cancelSleepTimer resets paused and endsAt', () => {
    useMediaStore.getState().startSleepTimer(300)
    useMediaStore.getState().cancelSleepTimer()
    const { sleepTimerActive, sleepTimerPaused, remainingSleepSeconds, sleepTimerEndsAt } = useMediaStore.getState()
    expect(sleepTimerActive).toBe(false)
    expect(sleepTimerPaused).toBe(false)
    expect(remainingSleepSeconds).toBe(0)
    expect(sleepTimerEndsAt).toBeNull()
  })

  it('pauseSleepTimer sets paused=true and endsAt=null while leaving active=true', () => {
    useMediaStore.getState().startSleepTimer(300)
    useMediaStore.getState().pauseSleepTimer()
    const { sleepTimerPaused, sleepTimerEndsAt, sleepTimerActive } = useMediaStore.getState()
    expect(sleepTimerPaused).toBe(true)
    expect(sleepTimerEndsAt).toBeNull()
    expect(sleepTimerActive).toBe(true)
  })

  it('resumeSleepTimer sets paused=false and recalculates endsAt', () => {
    useMediaStore.getState().startSleepTimer(300)
    useMediaStore.getState().pauseSleepTimer()
    const before = Date.now()
    useMediaStore.getState().resumeSleepTimer()
    const { sleepTimerPaused, sleepTimerEndsAt } = useMediaStore.getState()
    expect(sleepTimerPaused).toBe(false)
    expect(sleepTimerEndsAt).toBeGreaterThanOrEqual(before + 300000 - 50)
    expect(sleepTimerEndsAt).toBeLessThanOrEqual(Date.now() + 300000 + 50)
  })

  it('setSleepTimer updates remainingSleepSeconds', () => {
    useMediaStore.getState().startSleepTimer(300)
    useMediaStore.getState().setSleepTimer(60)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(60)
  })

  it('setSleepTimer recalculates endsAt when active and not paused', () => {
    useMediaStore.getState().startSleepTimer(300)
    const before = Date.now()
    useMediaStore.getState().setSleepTimer(60)
    const { sleepTimerEndsAt } = useMediaStore.getState()
    expect(sleepTimerEndsAt).toBeGreaterThanOrEqual(before + 60000 - 50)
    expect(sleepTimerEndsAt).toBeLessThanOrEqual(Date.now() + 60000 + 50)
  })

  it('setSleepTimer sets endsAt=null when paused', () => {
    useMediaStore.getState().startSleepTimer(300)
    useMediaStore.getState().pauseSleepTimer()
    useMediaStore.getState().setSleepTimer(60)
    expect(useMediaStore.getState().sleepTimerEndsAt).toBeNull()
  })

  it('setSleepTimer auto-starts and sets endsAt when inactive', () => {
    const before = Date.now()
    useMediaStore.getState().setSleepTimer(60)
    const { sleepTimerActive, sleepTimerEndsAt } = useMediaStore.getState()
    expect(sleepTimerActive).toBe(true)
    expect(sleepTimerEndsAt).toBeGreaterThanOrEqual(before + 60000 - 50)
    expect(sleepTimerEndsAt).toBeLessThanOrEqual(Date.now() + 60000 + 50)
  })

  it('setVolume clamps values above 100', () => {
    useMediaStore.getState().setVolume(150)
    expect(useMediaStore.getState().volume).toBe(100)
  })

  it('setVolume clamps values below 0', () => {
    useMediaStore.getState().setVolume(-10)
    expect(useMediaStore.getState().volume).toBe(0)
  })

  it('setVolume auto-mutes when set to 0', () => {
    useMediaStore.getState().setVolume(0)
    expect(useMediaStore.getState().isMuted).toBe(true)
    expect(useMediaStore.getState().volume).toBe(0)
  })

  it('setVolume auto-unmutes when set above 0 while muted', () => {
    useMediaStore.getState().setVolume(0)
    useMediaStore.getState().setVolume(50)
    expect(useMediaStore.getState().isMuted).toBe(false)
    expect(useMediaStore.getState().volume).toBe(50)
  })

  it('toggleMute saves previousVolume and mutes', () => {
    useMediaStore.setState({ volume: 80, isMuted: false })
    useMediaStore.getState().toggleMute()
    const { isMuted, volume, previousVolume } = useMediaStore.getState()
    expect(isMuted).toBe(true)
    expect(volume).toBe(0)
    expect(previousVolume).toBe(80)
  })

  it('toggleMute restores previousVolume on unmute', () => {
    useMediaStore.setState({ volume: 80, isMuted: false })
    useMediaStore.getState().toggleMute()
    useMediaStore.getState().toggleMute()
    const { isMuted, volume } = useMediaStore.getState()
    expect(isMuted).toBe(false)
    expect(volume).toBe(80)
  })

  it('setMuted(true) saves previousVolume and zeroes volume', () => {
    useMediaStore.setState({ volume: 60, isMuted: false })
    useMediaStore.getState().setMuted(true)
    const { isMuted, volume, previousVolume } = useMediaStore.getState()
    expect(isMuted).toBe(true)
    expect(volume).toBe(0)
    expect(previousVolume).toBe(60)
  })

  it('setMuted(false) restores previousVolume', () => {
    useMediaStore.setState({ volume: 60, isMuted: false })
    useMediaStore.getState().setMuted(true)
    useMediaStore.getState().setMuted(false)
    expect(useMediaStore.getState().isMuted).toBe(false)
    expect(useMediaStore.getState().volume).toBe(60)
  })

  it('setMuted is idempotent when already in target state', () => {
    useMediaStore.setState({ volume: 60, isMuted: false })
    useMediaStore.getState().setMuted(false)
    expect(useMediaStore.getState().volume).toBe(60)
    expect(useMediaStore.getState().isMuted).toBe(false)
  })

})
