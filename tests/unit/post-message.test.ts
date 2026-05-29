import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postMessageToNative } from '@/lib/bridge/post-message'

describe('postMessageToNative', () => {
  beforeEach(() => {
    delete (window as any).Android
    delete (window as any).webkit
  })

  it('calls Android.postMessage when Android interface present', () => {
    const mockPostMessage = vi.fn()
    ;(window as any).Android = { postMessage: mockPostMessage }
    postMessageToNative({ isPlaying: true })
    expect(mockPostMessage).toHaveBeenCalledWith('{"isPlaying":true}')
  })

  it('calls webkit.messageHandlers.messageHandler.postMessage when on iOS', () => {
    const mockPostMessage = vi.fn()
    ;(window as any).webkit = {
      messageHandlers: { messageHandler: { postMessage: mockPostMessage } },
    }
    postMessageToNative({ isPlaying: true })
    expect(mockPostMessage).toHaveBeenCalledWith('{"isPlaying":true}')
  })

  it('does nothing when no native interface present', () => {
    expect(() => postMessageToNative({ isPlaying: true })).not.toThrow()
  })
})
