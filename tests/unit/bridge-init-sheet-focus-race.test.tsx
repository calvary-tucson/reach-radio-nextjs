import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { ContactSheet } from '@/components/about/ContactSheet'
import { useMediaStore } from '@/lib/store/media-store'
import { useModalStore } from '@/lib/stores/modal'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/about',
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

// Real ContactForm pulls in server actions/reCAPTCHA — stub with real <input>
// elements so focus/blur still bubbles focusin/focusout through the actual
// ContactSheet dialog markup (the thing BridgeInit's guard has to recognize).
vi.mock('@/components/about/ContactForm', () => ({
  ContactForm: () => (
    <form>
      <input aria-label="Name" />
      <input aria-label="Email" />
    </form>
  ),
}))

describe('BridgeInit — focus race with a standalone sheet (ContactSheet)', () => {
  beforeEach(() => {
    useMediaStore.setState({ showMediaBar: true })
    useModalStore.getState().close()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('hides the media bar on open and keeps it hidden while focus moves between fields, restoring it on close', () => {
    const { unmount } = render(
      <>
        <BridgeInit streamUrl="https://stream.example.com" />
        <ContactSheet open onClose={vi.fn()} />
      </>
    )

    // ContactSheet itself owns hiding the bar for its whole lifetime —
    // matches ModalLayout's isOpen effect, doesn't wait for a field to focus.
    expect(useMediaStore.getState().showMediaBar).toBe(false)

    const nameInput = screen.getByLabelText('Name')
    const emailInput = screen.getByLabelText('Email')

    fireEvent.focusIn(nameInput)
    expect(useMediaStore.getState().showMediaBar).toBe(false)

    // Simulate Tab: blur the name field, focus the email field — both
    // targets are still inside the sheet's aria-modal dialog. Without
    // BridgeInit's aria-modal guard, this blur would race ContactSheet's
    // effect and restore the bar to visible mid-sheet.
    fireEvent.focusOut(nameInput)
    expect(useMediaStore.getState().showMediaBar).toBe(false)

    fireEvent.focusIn(emailInput)
    expect(useMediaStore.getState().showMediaBar).toBe(false)

    unmount()
    expect(useMediaStore.getState().showMediaBar).toBe(true)
  })
})
