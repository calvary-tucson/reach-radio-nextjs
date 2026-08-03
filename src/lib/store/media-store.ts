import { create } from 'zustand'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'

interface MediaState {
  isPlaying: boolean
  isBuffering: boolean
  isMuted: boolean
  volume: number
  previousVolume: number
  title: string
  artist: string
  resolvedArtist: string | null
  image: string
  showMediaBar: boolean
  sleepTimerActive: boolean
  sleepTimerPaused: boolean
  sleepTimerEndsAt: number | null
  remainingSleepSeconds: number
  sleepTimerSheetOpen: boolean
  openStandaloneSheetCount: number
  setIsPlaying: (v: boolean) => void
  setIsBuffering: (v: boolean) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setMuted: (v: boolean) => void
  setNowPlaying: (title: string, artist: string, resolvedArtist: string | null, image: string) => void
  setShowMediaBar: (v: boolean) => void
  setSleepTimerActive: (active: boolean) => void
  setRemainingSleepSeconds: (s: number) => void
  startSleepTimer: (seconds: number) => void
  pauseSleepTimer: () => void
  resumeSleepTimer: () => void
  cancelSleepTimer: () => void
  setSleepTimer: (seconds: number) => void
  openSleepTimerSheet: () => void
  closeSleepTimerSheet: () => void
  incrementOpenStandaloneSheetCount: () => void
  decrementOpenStandaloneSheetCount: () => void
}

export const useMediaStore = create<MediaState>((set, get) => ({
  isPlaying: false,
  isBuffering: false,
  isMuted: false,
  volume: 100,
  previousVolume: 100,
  title: 'Reach Radio',
  artist: '',
  resolvedArtist: null,
  image: FALLBACK_OG_IMAGE,
  showMediaBar: false,
  sleepTimerActive: false,
  sleepTimerPaused: false,
  sleepTimerEndsAt: null,
  remainingSleepSeconds: 0,
  sleepTimerSheetOpen: false,
  openStandaloneSheetCount: 0,
  setIsPlaying: (v) => set({ isPlaying: v }),
  setIsBuffering: (v) => set({ isBuffering: v }),
  setVolume: (v) => { const clamped = Math.max(0, Math.min(100, v)); set((s) => ({ volume: clamped, isMuted: clamped === 0, previousVolume: clamped === 0 ? s.volume : s.previousVolume })) },
  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get()
    if (isMuted) {
      set({ isMuted: false, volume: previousVolume > 0 ? previousVolume : 100 })
    } else {
      set({ isMuted: true, previousVolume: volume, volume: 0 })
    }
  },
  setMuted: (v) => {
    const { isMuted, volume, previousVolume } = get()
    if (v && !isMuted) {
      set({ isMuted: true, previousVolume: volume, volume: 0 })
    } else if (!v && isMuted) {
      set({ isMuted: false, volume: previousVolume > 0 ? previousVolume : 100 })
    }
  },
  setNowPlaying: (title, artist, resolvedArtist, image) => set({ title, artist, resolvedArtist, image }),
  setShowMediaBar: (v) => set({ showMediaBar: v }),
  setSleepTimerActive: (active) => set({ sleepTimerActive: active }),
  setRemainingSleepSeconds: (s) => set({ remainingSleepSeconds: s }),
  startSleepTimer: (seconds) => set({
    remainingSleepSeconds: seconds,
    sleepTimerActive: true,
    sleepTimerPaused: false,
    sleepTimerEndsAt: Date.now() + seconds * 1000,
  }),
  pauseSleepTimer: () => {
    const { sleepTimerActive, sleepTimerPaused } = get()
    if (!sleepTimerActive || sleepTimerPaused) return
    set({ sleepTimerPaused: true, sleepTimerEndsAt: null })
  },
  resumeSleepTimer: () => {
    const { sleepTimerActive, sleepTimerPaused, remainingSleepSeconds } = get()
    if (!sleepTimerActive || !sleepTimerPaused) return
    set({ sleepTimerPaused: false, sleepTimerEndsAt: Date.now() + remainingSleepSeconds * 1000 })
  },
  cancelSleepTimer: () => set({ sleepTimerActive: false, sleepTimerPaused: false, remainingSleepSeconds: 0, sleepTimerEndsAt: null }),
  setSleepTimer: (seconds) => {
    const { sleepTimerActive, sleepTimerPaused } = get()
    if (!sleepTimerActive) {
      // Auto-start when idle — safe default for callers (e.g. CarPlay) that skip startSleepTimer
      set({ remainingSleepSeconds: seconds, sleepTimerActive: true, sleepTimerPaused: false, sleepTimerEndsAt: Date.now() + seconds * 1000 })
    } else {
      set({ remainingSleepSeconds: seconds, sleepTimerEndsAt: !sleepTimerPaused ? Date.now() + seconds * 1000 : null })
    }
  },
  openSleepTimerSheet: () => set({ sleepTimerSheetOpen: true }),
  closeSleepTimerSheet: () => set({ sleepTimerSheetOpen: false }),
  incrementOpenStandaloneSheetCount: () => set((s) => ({ openStandaloneSheetCount: s.openStandaloneSheetCount + 1 })),
  decrementOpenStandaloneSheetCount: () => set((s) => ({ openStandaloneSheetCount: Math.max(0, s.openStandaloneSheetCount - 1) })),
}))
