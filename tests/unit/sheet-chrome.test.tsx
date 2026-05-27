import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { ModalProvider } from '@/components/modals/ModalContext'
import { MODAL_ENTER_ANIMATION } from '@/lib/constants/modal'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

function Wrapper({ isClosing = false, onDismiss = vi.fn() } = {}) {
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={isClosing}>
      <SheetChrome title="Test Sheet">
        <p>Sheet content</p>
      </SheetChrome>
    </ModalProvider>
  )
}

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
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('close button has cursor-pointer', () => {
    render(<Wrapper />)
    const btn = screen.getByRole('button', { name: /close/i })
    expect(btn.className).toContain('cursor-pointer')
  })
})
