import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { useModalStore } from '@/lib/stores/modal'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

let mockPathname = '/teachers/search'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => mockPathname,
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

// Real isTeacherDetailPath: '/teachers/search' is explicitly excluded from
// detail-path matching, which is what makes it collide with ModalLayout's
// hide-on-open message.
vi.mock('@/lib/routes', async () => {
  const actual = await vi.importActual('@/lib/routes')
  return actual
})

describe('BridgeInit — route effect vs. open sheet', () => {
  beforeEach(() => {
    mockPathname = '/teachers/search'
    useModalStore.setState({ isOpen: true, rootSheet: 'search' })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useModalStore.getState().close()
  })

  it('does not re-show bars via the route effect while a modal sheet is open', () => {
    render(<BridgeInit streamUrl="https://stream.example.com" />)
    const calls = vi.mocked(postMessageToNative).mock.calls
    const routeCall = calls.find(([payload]) => payload.location === '/teachers/search')
    expect(routeCall).toBeTruthy()
    expect(routeCall?.[0]).not.toHaveProperty('showMediaBar', true)
    expect(routeCall?.[0]).not.toHaveProperty('showMobileNav', true)
  })

  it('still sends showMediaBar/showMobileNav on route change when no modal is open', () => {
    useModalStore.setState({ isOpen: false })
    mockPathname = '/teachers'
    render(<BridgeInit streamUrl="https://stream.example.com" />)
    const calls = vi.mocked(postMessageToNative).mock.calls
    const routeCall = calls.find(([payload]) => payload.location === '/teachers')
    expect(routeCall?.[0]).toMatchObject({ showMediaBar: true, showMobileNav: true })
  })
})

describe('BridgeInit — route effect vs. open standalone sheet', () => {
  beforeEach(() => {
    mockPathname = '/teachers/search'
    useMediaStore.setState({ openStandaloneSheetCount: 1 })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useMediaStore.setState({ openStandaloneSheetCount: 0 })
  })

  it('does not re-show bars via the route effect while a standalone sheet is open', () => {
    render(<BridgeInit streamUrl="https://stream.example.com" />)
    const calls = vi.mocked(postMessageToNative).mock.calls
    const routeCall = calls.find(([payload]) => payload.location === '/teachers/search')
    expect(routeCall).toBeTruthy()
    expect(routeCall?.[0]).not.toHaveProperty('showMediaBar', true)
    expect(routeCall?.[0]).not.toHaveProperty('showMobileNav', true)
  })

  it('still sends showMediaBar/showMobileNav on route change once the standalone sheet count returns to zero', () => {
    useMediaStore.setState({ openStandaloneSheetCount: 0 })
    mockPathname = '/teachers'
    render(<BridgeInit streamUrl="https://stream.example.com" />)
    const calls = vi.mocked(postMessageToNative).mock.calls
    const routeCall = calls.find(([payload]) => payload.location === '/teachers')
    expect(routeCall?.[0]).toMatchObject({ showMediaBar: true, showMobileNav: true })
  })
})
