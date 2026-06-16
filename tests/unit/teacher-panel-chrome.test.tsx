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

function Wrapper({
  onDismiss = vi.fn(),
  onBack = vi.fn(),
  isClosing = false,
  stackDepth = 0,
}: {
  onDismiss?: () => void
  onBack?: () => void
  isClosing?: boolean
  stackDepth?: number
} = {}) {
  return (
    <ModalProvider
      onDismiss={onDismiss}
      onBack={onBack}
      isClosing={isClosing}
      stackDepth={stackDepth}
    >
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
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    expect(closeButtons.length).toBeGreaterThanOrEqual(2) // DragHandle + desktop X
  })

  it('does not render back button when stackDepth is 0', () => {
    render(<Wrapper stackDepth={0} />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('renders back button when stackDepth > 0', () => {
    render(<Wrapper stackDepth={1} />)
    expect(screen.getAllByRole('button', { name: /back/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('back button calls onBack', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<Wrapper stackDepth={1} onBack={onBack} />)
    const backBtns = screen.getAllByRole('button', { name: /back/i })
    await user.click(backBtns[0])
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('X close button calls onDismiss, not onBack, even when stacked', async () => {
    const onDismiss = vi.fn()
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<Wrapper stackDepth={1} onDismiss={onDismiss} onBack={onBack} />)
    const desktopClose = screen.getByTestId('desktop-close-btn')
    await user.click(desktopClose)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onBack).not.toHaveBeenCalled()
  })
})
