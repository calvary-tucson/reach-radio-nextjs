import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherPanelShell } from '@/components/modals/chrome/TeacherPanelShell'
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
      <TeacherPanelShell>
        <p>Panel content</p>
      </TeacherPanelShell>
    </ModalProvider>
  )
}

describe('TeacherPanelShell', () => {
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

  it('hides Back at root: inert + tabIndex -1 + aria-hidden, out of the a11y tree', () => {
    render(<Wrapper stackDepth={0} />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    const hidden = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label="Back"]'))
    expect(hidden.length).toBeGreaterThanOrEqual(1)
    hidden.forEach((b) => {
      expect(b.hasAttribute('inert')).toBe(true)
      expect(b.getAttribute('tabindex')).toBe('-1')
      expect(b.getAttribute('aria-hidden')).toBe('true')
    })
  })

  it('shows Back (no inert/aria-hidden) when stackDepth > 0', () => {
    render(<Wrapper stackDepth={1} />)
    const backs = screen.getAllByRole('button', { name: /back/i })
    expect(backs.length).toBeGreaterThanOrEqual(1)
    backs.forEach((b) => {
      expect(b.hasAttribute('inert')).toBe(false)
      expect(b.hasAttribute('aria-hidden')).toBe(false)
    })
  })

  it('moves focus to the dialog when the focused Back hides on return to root', () => {
    const { rerender } = render(<Wrapper stackDepth={1} />)
    const back = screen.getAllByRole('button', { name: /back/i })[0]
    back.focus()
    expect(document.activeElement).toBe(back)
    rerender(<Wrapper stackDepth={0} />)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('moves focus to the dialog when the browser drops focus (blur to body) as Back hides', () => {
    const { rerender } = render(<Wrapper stackDepth={1} />)
    const back = screen.getAllByRole('button', { name: /back/i })[0]
    back.focus()
    // Real browsers blur the element as it goes inert, before effects run.
    act(() => { back.blur() })
    expect(document.activeElement).toBe(document.body)
    rerender(<Wrapper stackDepth={0} />)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('does not steal focus when Back hides and focus was elsewhere', () => {
    const { rerender } = render(<Wrapper stackDepth={1} />)
    const close = screen.getAllByRole('button', { name: /close/i })[0]
    close.focus()
    rerender(<Wrapper stackDepth={0} />)
    expect(document.activeElement).toBe(close)
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

describe('TeacherPanelShell lifecycle', () => {
  it('stays mounted (same DOM node) across stackDepth 0 -> 1 -> 0', () => {
    const { rerender } = render(<Wrapper stackDepth={0} />)
    const dialog = screen.getByRole('dialog')
    rerender(<Wrapper stackDepth={1} />)
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(dialog.isConnected).toBe(true)
    rerender(<Wrapper stackDepth={0} />)
    expect(screen.getByRole('dialog')).toBe(dialog)
  })

  it('plays the slide-in on mount and the exit animation while closing', () => {
    const { rerender } = render(<Wrapper />)
    expect(screen.getByRole('dialog').className).toContain('panel-slide-in')
    rerender(<Wrapper isClosing />)
    expect(screen.getByRole('dialog').className).toContain('slide-out')
  })

  it('Escape-independent dismiss: clicking the backdrop calls onDismiss', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<Wrapper onDismiss={onDismiss} />)
    await user.click(container.querySelector('[role="presentation"]') as HTMLElement)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
