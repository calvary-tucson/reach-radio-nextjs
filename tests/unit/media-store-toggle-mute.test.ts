import { describe, it, expect, beforeEach } from 'vitest'
import { useMediaStore } from '@/lib/store/media-store'

describe('useMediaStore — toggleMute and setMuted', () => {
  beforeEach(() => {
    useMediaStore.setState({
      isPlaying: false,
      isBuffering: false,
      isMuted: false,
      volume: 80,
      previousVolume: 80,
    })
  })

  describe('toggleMute', () => {
    it('mutes: sets isMuted true, volume to 0, saves previousVolume', () => {
      useMediaStore.getState().toggleMute()
      const { isMuted, volume, previousVolume } = useMediaStore.getState()
      expect(isMuted).toBe(true)
      expect(volume).toBe(0)
      expect(previousVolume).toBe(80)
    })

    it('unmutes: restores previousVolume when toggled back', () => {
      useMediaStore.getState().toggleMute() // mute
      useMediaStore.getState().toggleMute() // unmute
      const { isMuted, volume } = useMediaStore.getState()
      expect(isMuted).toBe(false)
      expect(volume).toBe(80)
    })

    it('unmute with previousVolume 0 restores to 100 (guard against silent restore)', () => {
      useMediaStore.setState({ isMuted: true, volume: 0, previousVolume: 0 })
      useMediaStore.getState().toggleMute()
      expect(useMediaStore.getState().volume).toBe(100)
    })
  })

  describe('setMuted', () => {
    it('setMuted(true) from unmuted state mutes and saves volume', () => {
      useMediaStore.getState().setMuted(true)
      const { isMuted, volume, previousVolume } = useMediaStore.getState()
      expect(isMuted).toBe(true)
      expect(volume).toBe(0)
      expect(previousVolume).toBe(80)
    })

    it('setMuted(true) when already muted is idempotent — does not double-save previousVolume', () => {
      useMediaStore.setState({ isMuted: true, volume: 0, previousVolume: 80 })
      useMediaStore.getState().setMuted(true) // call again while already muted
      expect(useMediaStore.getState().previousVolume).toBe(80) // not 0
    })

    it('setMuted(false) from muted state restores previousVolume', () => {
      useMediaStore.setState({ isMuted: true, volume: 0, previousVolume: 60 })
      useMediaStore.getState().setMuted(false)
      expect(useMediaStore.getState().isMuted).toBe(false)
      expect(useMediaStore.getState().volume).toBe(60)
    })

    it('setMuted(false) when already unmuted is idempotent', () => {
      useMediaStore.getState().setMuted(false) // already unmuted
      expect(useMediaStore.getState().isMuted).toBe(false)
      expect(useMediaStore.getState().volume).toBe(80)
    })
  })

  describe('setVolume', () => {
    it('setVolume(0) sets isMuted true implicitly', () => {
      useMediaStore.getState().setVolume(0)
      expect(useMediaStore.getState().isMuted).toBe(true)
    })

    it('setVolume(50) sets isMuted false when was muted', () => {
      useMediaStore.setState({ isMuted: true })
      useMediaStore.getState().setVolume(50)
      expect(useMediaStore.getState().isMuted).toBe(false)
    })
  })
})
