import { create } from 'zustand'

const DEFAULT_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

interface MediaState {
  isPlaying: boolean
  isBuffering: boolean
  isMuted: boolean
  volume: number
  title: string
  artist: string
  image: string
  showMediaBar: boolean
  showMobileNav: boolean
  setIsPlaying: (v: boolean) => void
  setIsBuffering: (v: boolean) => void
  setIsMuted: (v: boolean) => void
  setVolume: (v: number) => void
  setNowPlaying: (title: string, artist: string, image: string) => void
  setShowMediaBar: (v: boolean) => void
  setShowMobileNav: (v: boolean) => void
}

export const useMediaStore = create<MediaState>((set) => ({
  isPlaying: false,
  isBuffering: false,
  isMuted: false,
  volume: 100,
  title: 'Reach Radio',
  artist: '',
  image: DEFAULT_IMAGE,
  showMediaBar: false,
  showMobileNav: true,
  setIsPlaying: (v) => set({ isPlaying: v }),
  setIsBuffering: (v) => set({ isBuffering: v }),
  setIsMuted: (v) => set({ isMuted: v }),
  setVolume: (v) => set({ volume: v }),
  setNowPlaying: (title, artist, image) => set({ title, artist, image }),
  setShowMediaBar: (v) => set({ showMediaBar: v }),
  setShowMobileNav: (v) => set({ showMobileNav: v }),
}))
