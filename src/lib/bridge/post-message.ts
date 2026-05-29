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

export function postMessageToNative(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const message = JSON.stringify(payload)
  if (window.Android?.postMessage) {
    window.Android.postMessage(message)
  } else if (window.webkit?.messageHandlers?.messageHandler?.postMessage) {
    window.webkit.messageHandlers.messageHandler.postMessage(message)
  }
}
