import { describe, it, expect, beforeEach } from 'vitest'
import { useModalStore } from '@/lib/stores/modal'

beforeEach(() => {
  useModalStore.setState({
    expectingRoute: false,
    isOpen: false,
    isClosing: false,
    title: null,
    originPath: null,
    keepAlive: false,
    triggerRef: null,
  })
})

describe('useModalStore', () => {
  it('openModal sets isOpen and expectingRoute', () => {
    useModalStore.getState().openModal('Test', '/page')
    const s = useModalStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.expectingRoute).toBe(true)
    expect(s.title).toBe('Test')
    expect(s.originPath).toBe('/page')
  })

  it('openModal twice keeps first originPath', () => {
    useModalStore.getState().openModal('First', '/first')
    useModalStore.getState().openModal('Second', '/second')
    expect(useModalStore.getState().originPath).toBe('/first')
  })

  it('startClosing sets isClosing', () => {
    useModalStore.getState().openModal()
    useModalStore.getState().startClosing()
    expect(useModalStore.getState().isClosing).toBe(true)
  })

  it('close resets all state', () => {
    useModalStore.getState().openModal('T', '/x')
    useModalStore.getState().close()
    const s = useModalStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.title).toBeNull()
    expect(s.originPath).toBeNull()
    expect(s.isClosing).toBe(false)
    expect(s.keepAlive).toBe(false)
  })

  it('routeExpected and routeArrived toggle expectingRoute', () => {
    useModalStore.getState().routeExpected()
    expect(useModalStore.getState().expectingRoute).toBe(true)
    useModalStore.getState().routeArrived()
    expect(useModalStore.getState().expectingRoute).toBe(false)
  })

  it('setKeepAlive updates keepAlive', () => {
    useModalStore.getState().setKeepAlive(true)
    expect(useModalStore.getState().keepAlive).toBe(true)
  })
})
