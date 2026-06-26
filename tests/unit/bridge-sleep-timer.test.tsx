import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

vi.mock('@/lib/routes', () => ({
  isTeacherDetailPath: () => false,
}))

beforeAll(() => {
  Object.defineProperty(window, 'inNativeApp', { value: true, configurable: true, writable: true })
})

function dispatchCommand(detail: object) {
  window.dispatchEvent(new CustomEvent('nativeCommand', { detail }))
}

describe('BridgeInit — sleep timer commands', () => {
  beforeEach(() => {
    useMediaStore.setState({
      sleepTimerActive: false,
      sleepTimerPaused: false,
      remainingSleepSeconds: 0,
      sleepTimerEndsAt: null,
    })
    render(<BridgeInit streamUrl="https://stream.example.com" />)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('startSleepTimer command activates timer with given seconds', () => {
    dispatchCommand({ type: 'startSleepTimer', seconds: 300 })
    expect(useMediaStore.getState().sleepTimerActive).toBe(true)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(300)
  })

  it('pauseSleepTimer command sets paused=true', () => {
    useMediaStore.getState().startSleepTimer(300)
    dispatchCommand({ type: 'pauseSleepTimer' })
    expect(useMediaStore.getState().sleepTimerPaused).toBe(true)
  })

  it('resumeSleepTimer command sets paused=false', () => {
    useMediaStore.getState().startSleepTimer(300)
    useMediaStore.getState().pauseSleepTimer()
    dispatchCommand({ type: 'resumeSleepTimer' })
    expect(useMediaStore.getState().sleepTimerPaused).toBe(false)
  })

  it('cancelSleepTimer command deactivates timer', () => {
    useMediaStore.getState().startSleepTimer(300)
    dispatchCommand({ type: 'cancelSleepTimer' })
    expect(useMediaStore.getState().sleepTimerActive).toBe(false)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(0)
  })

  it('setSleepTimer command updates remaining seconds', () => {
    useMediaStore.getState().startSleepTimer(300)
    dispatchCommand({ type: 'setSleepTimer', seconds: 60 })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(60)
  })
})
