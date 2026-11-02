import { describe, it, expect, beforeEach } from 'vitest'
import { useModalStore } from '@/lib/stores/modal'

beforeEach(() => {
  useModalStore.setState({
    expectingRoute: false,
    isOpen: false,
    isClosing: false,
    title: null,
    triggerRef: null,
  })
})

describe('useModalStore', () => {
  it('openModal sets isOpen and expectingRoute', () => {
    useModalStore.getState().openModal('Test')
    const s = useModalStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.expectingRoute).toBe(true)
    expect(s.title).toBe('Test')
  })

  it('startClosing sets isClosing', () => {
    useModalStore.getState().openModal()
    useModalStore.getState().startClosing()
    expect(useModalStore.getState().isClosing).toBe(true)
  })

  it('close resets all state', () => {
    useModalStore.getState().openModal('T')
    useModalStore.getState().close()
    const s = useModalStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.title).toBeNull()
    expect(s.isClosing).toBe(false)
  })

  it('routeArrived clears expectingRoute', () => {
    useModalStore.getState().openModal()
    expect(useModalStore.getState().expectingRoute).toBe(true)
    useModalStore.getState().routeArrived()
    expect(useModalStore.getState().expectingRoute).toBe(false)
  })

  it('tracks navDirection: pushModal push, prepareBack pop, open/close/clear null', () => {
    const s = () => useModalStore.getState()
    expect(s().navDirection).toBeNull()
    s().openModal('A')
    expect(s().navDirection).toBeNull()
    s().pushModal('B')
    expect(s().navDirection).toBe('push')
    s().prepareBack()
    expect(s().navDirection).toBe('pop')
    s().clearNavDirection()
    expect(s().navDirection).toBeNull()
    s().pushModal('C')
    s().openModal('D')
    expect(s().navDirection).toBeNull()
    s().pushModal('E')
    s().openSearchSheet('S')
    expect(s().navDirection).toBeNull()
    s().pushModal('F')
    s().close()
    expect(s().navDirection).toBeNull()
  })
})
