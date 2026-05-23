import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from './post-message'

declare global {
  interface Window {
    globalState: {
      mediaBarState: {
        isPlaying: { set: (v: boolean) => void }
        isBuffering: { set: (v: boolean) => void }
        isMuted: { set: (v: boolean) => void }
        showMediaBar: { set: (v: boolean) => void }
      }
    }
    globalActions: {
      goToPage: (path: string) => void
      goBack: () => void
      setPlayingTrue: () => void
      setPlayingFalse: () => void
      setBufferingTrue: () => void
      setBufferingFalse: () => void
      toggleMediaBar: (flag: boolean) => void
    }
  }
}

export function initBridgeProxy(router?: { push: (path: string) => void }): void {
  if (typeof window === 'undefined') return

  window.globalState = {
    mediaBarState: {
      isPlaying: { set: (v) => useMediaStore.getState().setIsPlaying(v) },
      isBuffering: { set: (v) => useMediaStore.getState().setIsBuffering(v) },
      isMuted: { set: (v) => useMediaStore.getState().setMuted(v) },
      showMediaBar: { set: (v) => useMediaStore.getState().setShowMediaBar(v) },
    },
  }

  window.globalActions = {
    goToPage: (path) => {
      if (router) {
        router.push(path)
      } else {
        window.location.href = path
      }
    },
    goBack: () => window.history.back(),
    setPlayingTrue: () => useMediaStore.getState().setIsPlaying(true),
    setPlayingFalse: () => useMediaStore.getState().setIsPlaying(false),
    setBufferingTrue: () => useMediaStore.getState().setIsBuffering(true),
    setBufferingFalse: () => useMediaStore.getState().setIsBuffering(false),
    toggleMediaBar: (flag) => {
      useMediaStore.getState().setShowMediaBar(flag)
      postMessageToNative(JSON.stringify({ showMediaBar: flag }))
    },
  }
}
