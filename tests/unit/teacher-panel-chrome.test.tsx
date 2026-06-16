import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherPanelChrome } from '@/components/modals/chrome/TeacherPanelChrome'
import { ModalProvider } from '@/components/modals/ModalContext'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

function Wrapper({ onDismiss = vi.fn(), isClosing = false } = {}) {
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={isClosing}>
      <TeacherPanelChrome>
        <p>Panel content</p>
      </TeacherPanelChrome>
    </ModalProvider>
  )
}

describe('TeacherPanelChrome', () => {
  it('renders children', () => {
    render(<Wrapper />)
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('desktop close button calls onDismiss', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(<Wrapper onDismiss={onDismiss} />)
    const desktopClose = screen.getByTestId('desktop-close-btn')
    await user.click(desktopClose)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('tablet drag zone is present', () => {
    render(<Wrapper />)
    expect(screen.getByTestId('tablet-drag-zone')).toBeInTheDocument()
  })

  it('mobile drag handle button is present in DOM', () => {
    render(<Wrapper />)
    // DragHandle renders a button with aria-label "Close" — in DOM even if CSS-hidden
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    expect(closeButtons.length).toBeGreaterThanOrEqual(2) // DragHandle + desktop X
  })
})
