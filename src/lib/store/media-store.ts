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
  sleepTimerActive: boolean
  remainingSleepSeconds: number
  setIsPlaying: (v: boolean) => void
  setIsBuffering: (v: boolean) => void
  setIsMuted: (v: boolean) => void
  setVolume: (v: number) => void
  setNowPlaying: (title: string, artist: string, image: string) => void
  setShowMediaBar: (v: boolean) => void
  setSleepTimerActive: (active: boolean) => void
  setRemainingSleepSeconds: (s: number) => void
  startSleepTimer: (seconds: number) => void
  teachersList: { name: string; photo: string }[]
  setTeachersList: (list: { name: string; photo: string }[]) => void
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
  sleepTimerActive: false,
  remainingSleepSeconds: 0,
  setIsPlaying: (v) => set({ isPlaying: v }),
  setIsBuffering: (v) => set({ isBuffering: v }),
  setIsMuted: (v) => set({ isMuted: v }),
  setVolume: (v) => set({ volume: v, isMuted: v === 0 }),
  setNowPlaying: (title, artist, image) => set({ title, artist, image }),
  setShowMediaBar: (v) => set({ showMediaBar: v }),
  setSleepTimerActive: (active) => set({ sleepTimerActive: active }),
  setRemainingSleepSeconds: (s) => set({ remainingSleepSeconds: s }),
  startSleepTimer: (seconds) => set({ remainingSleepSeconds: seconds, sleepTimerActive: true }),
  teachersList: [],
  setTeachersList: (list) => set({ teachersList: list }),
}))
