import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { postMessageToNative } from '@/lib/bridge/post-message'

let mockPathname = '/about'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => mockPathname,
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

// The focus/blur effect must react to the pathname current at blur time, not
// the pathname captured whenever its listeners were attached — a navigation
// can land while an input is still focused (e.g. router.push from a native
// command while the on-page search field has focus).
describe('BridgeInit — focus/blur effect reads live pathname', () => {
  beforeEach(() => {
    vi.mocked(postMessageToNative).mockClear()
    mockPathname = '/about'
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('derives showMobileNav/showMediaBar from the post-navigation pathname on blur, not the mount-time one', () => {
    const { rerender } = render(<BridgeInit streamUrl="https://stream.example.com" />)

    const input = document.createElement('input')
    document.body.appendChild(input)

    fireEvent.focusIn(input)

    // Navigate to a teacher detail path while the input is still focused,
    // then re-render so BridgeInit picks up the new pathname from the router.
    mockPathname = '/teachers/john-macarthur'
    rerender(<BridgeInit streamUrl="https://stream.example.com" />)

    fireEvent.focusOut(input)

    const calls = vi.mocked(postMessageToNative).mock.calls
    const blurCall = calls.at(-1)?.[0]
    // isTeacherDetailPath('/teachers/john-macarthur') === true, so both bars
    // must come back derived from the NEW pathname: showMobileNav false.
    expect(blurCall).toMatchObject({ showMobileNav: false })

    document.body.removeChild(input)
  })
})
