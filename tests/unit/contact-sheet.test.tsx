import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContactSheet } from '@/components/about/ContactSheet'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('next/navigation', () => ({
  usePathname: () => '/about',
}))

// Mock SheetChrome — isolate ContactSheet behavior from SheetChrome internals
vi.mock('@/components/modals/chrome/SheetChrome', () => ({
  SheetChrome: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}))

// Mock ContactForm — we test form behavior separately
vi.mock('@/components/about/ContactForm', () => ({
  ContactForm: ({ onSuccess }: { onSuccess?: () => void }) => (
    <button onClick={onSuccess}>Submit</button>
  ),
}))

// Mock ModalProvider — pass through children
vi.mock('@/components/modals/ModalContext', () => ({
  ModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock bridge — postMessageToNative is a no-op in tests
vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

describe('ContactSheet', () => {
  it('renders nothing when closed', () => {
    render(<ContactSheet open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open', () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders backdrop when open', () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('contact-sheet-backdrop')).toBeInTheDocument()
  })

  it('calls onClose after Escape key + animation delay', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<ContactSheet open={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls onClose when form submission succeeds (via onSuccess)', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<ContactSheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Submit'))
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('does not call onClose when Escape pressed while closed', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<ContactSheet open={false} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    vi.advanceTimersByTime(300)
    expect(onClose).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('hides both the native media bar and bottom nav while open', () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    expect(postMessageToNative).toHaveBeenCalledWith({ showMobileNav: false, showMediaBar: false })
  })

  it('restores the media bar to its pre-sheet store value on unmount, not a value derived from pathname', () => {
    // Deliberately start at false — pathname-derivation (mocked '/about', not
    // '/', not a teacher detail path) would produce true, so restoring false
    // here proves the hook replays the captured value instead of recomputing.
    useMediaStore.setState({ showMediaBar: false })
    const { unmount } = render(<ContactSheet open={true} onClose={vi.fn()} />)
    unmount()
    expect(postMessageToNative).toHaveBeenCalledWith({ showMobileNav: true, showMediaBar: false })
  })
})
