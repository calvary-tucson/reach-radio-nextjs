declare global {
  interface Window {
    Android?: { postMessage: (msg: string) => void }
    webkit?: {
      messageHandlers: {
        messageHandler: { postMessage: (msg: string) => void }
      }
    }
    // ReactNativeWebView: iOS sets this to `true` (a boolean), never an object with postMessage.
    // Kept for documentation only — postMessageToNative does not call it.
    inNativeApp?: boolean
    globalActions?: {
      goToPage: (path: string) => void
      goBack: () => void
    }
    globalState?: {
      mediaBarState: {
        isPlaying: { set: (v: boolean) => void }
        isBuffering: { set: (v: boolean) => void }
        isMuted: { set: (v: boolean) => void }
        showMediaBar: { set: (v: boolean) => void }
      }
    }
    up?: {
      navigate: (opts: { url: string }) => void
      reload: () => void
      history: { readonly location: string }
    }
  }
}

export function postMessageToNative(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const message = JSON.stringify({ protocolVersion: 1, ...payload })
  if (window.Android?.postMessage) {
    window.Android.postMessage(message)
  } else if (window.webkit?.messageHandlers?.messageHandler?.postMessage) {
    window.webkit.messageHandlers.messageHandler.postMessage(message)
  }
}
