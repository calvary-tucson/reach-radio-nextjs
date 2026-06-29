import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, useEffect } from 'react'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { ModalProvider } from '@/components/modals/ModalContext'
import { MODAL_ENTER_ANIMATION } from '@/lib/constants/modal'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

function Wrapper({ isClosing = false, onDismiss = vi.fn() } = {}) {
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={isClosing} stackDepth={0}>
      <SheetChrome title="Test Sheet">
        <p>Sheet content</p>
      </SheetChrome>
    </ModalProvider>
  )
}

// Wrapper with autoFocusInput and a synchronous input
function WrapperWithInput({ onDismiss = vi.fn() } = {}) {
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={false} stackDepth={0}>
      <SheetChrome title="Test Sheet" autoFocusInput>
        <input type="text" aria-label="Test input" />
      </SheetChrome>
    </ModalProvider>
  )
}

// Wrapper where input appears 50ms after mount (simulates Suspense resolving)
function WrapperWithDelayedInput({ onDismiss = vi.fn() } = {}) {
  function DelayedInput() {
    const [show, setShow] = useState(false)
    useEffect(() => {
      const id = setTimeout(() => setShow(true), 50)
      return () => clearTimeout(id)
    }, [])
    return show ? <input type="text" aria-label="Delayed input" /> : null
  }
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={false} stackDepth={0}>
      <SheetChrome title="Test Sheet" autoFocusInput>
        <DelayedInput />
      </SheetChrome>
    </ModalProvider>
  )
}

it('focuses first input when autoFocusInput is true (synchronous)', async () => {
  const { container } = render(<WrapperWithInput />)
  const input = container.querySelector('input')
  await waitFor(() => {
    expect(document.activeElement).toBe(input)
  })
})

it('focuses input that appears after mount (MutationObserver path)', async () => {
  const { container } = render(<WrapperWithDelayedInput />)
  await waitFor(
    () => expect(document.activeElement).toBe(container.querySelector('input')),
    { timeout: 500 }
  )
})

describe('SheetChrome', () => {
  it('renders children', () => {
    render(<Wrapper />)
    expect(screen.getByText('Sheet content')).toBeInTheDocument()
  })

  it('renders title', () => {
    render(<Wrapper />)
    expect(screen.getByRole('heading', { name: 'Test Sheet' })).toBeInTheDocument()
  })

  it('close button calls onDismiss', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(<Wrapper onDismiss={onDismiss} />)
    // Two "Close" buttons exist: drag handle (sm:hidden) and X button. Click the X.
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    await user.click(closeButtons[closeButtons.length - 1])
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('close button has cursor-pointer', () => {
    render(<Wrapper />)
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    const xButton = closeButtons[closeButtons.length - 1]
    expect(xButton.className).toContain('cursor-pointer')
  })
})
