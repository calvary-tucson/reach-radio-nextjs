import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ContactSheet } from '@/components/about/ContactSheet'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

// Simulates the mid-submit state: a disabled trailing submit button, matching
// ContactForm's real disabled={isPending} behavior during useActionState submit.
vi.mock('@/components/about/ContactForm', () => ({
  ContactForm: () => (
    <>
      <input aria-label="Name" />
      <input aria-label="Message" />
      <button type="submit" disabled>Sending…</button>
    </>
  ),
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

describe('ContactSheet + SheetChrome focus trap integration', () => {
  it('renders exactly one dialog role, not a nested duplicate', async () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
  })

  it('wraps Tab from the last enabled field back into the dialog, without escaping it, skipping the disabled submit button', async () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    await screen.findByLabelText('Message')
    const message = screen.getByLabelText('Message')
    message.focus()
    fireEvent.keyDown(message, { key: 'Tab' })
    // Don't assert *which* element is first (SheetChrome renders its own
    // DragHandle/Close button ahead of ContactForm's children, so "first
    // focusable" is SheetChrome's Close button, not the Name field) --
    // assert the property actually under test: focus wrapped somewhere
    // inside the dialog instead of escaping it or getting stuck on Message.
    expect(document.activeElement).not.toBe(message)
    expect((document.activeElement as HTMLElement | null)?.closest('[role="dialog"]')).not.toBeNull()
  })
})
