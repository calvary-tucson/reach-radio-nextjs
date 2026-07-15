import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postMessageToNative } from '@/lib/bridge/post-message'

describe('postMessageToNative', () => {
  beforeEach(() => {
    delete window.Android
    delete window.webkit
  })

  it('calls Android.postMessage when Android interface present', () => {
    const mockPostMessage = vi.fn()
    window.Android = { postMessage: mockPostMessage }
    postMessageToNative({ isPlaying: true })
    expect(mockPostMessage).toHaveBeenCalledWith('{"protocolVersion":1,"isPlaying":true}')
  })

  it('calls webkit.messageHandlers.messageHandler.postMessage when on iOS', () => {
    const mockPostMessage = vi.fn()
    window.webkit = {
      messageHandlers: { messageHandler: { postMessage: mockPostMessage } },
    }
    postMessageToNative({ isPlaying: true })
    expect(mockPostMessage).toHaveBeenCalledWith('{"protocolVersion":1,"isPlaying":true}')
  })

  it('does nothing when no native interface present', () => {
    expect(() => postMessageToNative({ isPlaying: true })).not.toThrow()
  })

  it('wraps messages with protocolVersion: 1', () => {
    const mockPostMessage = vi.fn()
    window.Android = { postMessage: mockPostMessage }
    postMessageToNative({ loaded: true })
    expect(mockPostMessage).toHaveBeenCalledWith('{"protocolVersion":1,"loaded":true}')
  })

  it('uses webkit when Android is not present', () => {
    const mockPostMessage = vi.fn()
    window.webkit = {
      messageHandlers: { messageHandler: { postMessage: mockPostMessage } },
    }
    postMessageToNative({ location: '/teachers' })
    expect(mockPostMessage).toHaveBeenCalledWith('{"protocolVersion":1,"location":"/teachers"}')
  })
})
