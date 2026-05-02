declare global {
  interface Window {
    Android?: { postMessage: (msg: string) => void }
    webkit?: {
      messageHandlers: {
        messageHandler: { postMessage: (msg: string) => void }
      }
    }
    ReactNativeWebView?: boolean
    inNativeApp?: boolean
  }
}

export function postMessageToNative(message: string): void {
  if (typeof window === 'undefined') return
  if (window.Android?.postMessage) {
    window.Android.postMessage(message)
  } else if (window.webkit?.messageHandlers?.messageHandler?.postMessage) {
    window.webkit.messageHandlers.messageHandler.postMessage(message)
  }
}
