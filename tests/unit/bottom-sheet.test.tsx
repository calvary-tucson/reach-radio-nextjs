import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomSheet } from '@/components/global/BottomSheet'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    render(
      <BottomSheet open={false} onClose={vi.fn()} ariaLabel="Test sheet">
        <p>Content</p>
      </BottomSheet>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders children when open', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()} ariaLabel="Test sheet">
        <p>Content</p>
      </BottomSheet>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test sheet">
        <p>Content</p>
      </BottomSheet>
    )
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls onClose when Escape pressed', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test sheet">
        <p>Content</p>
      </BottomSheet>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('has aria-modal and aria-label', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()} ariaLabel="Sleep timer">
        <p>Content</p>
      </BottomSheet>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Sleep timer')
  })
})
