import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DragHandle } from '@/components/global/DragHandle'
import type { useSheetDrag } from '@/lib/hooks/useSheetDrag'

function makeDrag(): ReturnType<typeof useSheetDrag> {
  return {
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }
}

describe('DragHandle', () => {
  it('renders a button with aria-label "Close"', () => {
    render(<DragHandle drag={makeDrag()} onDismiss={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('calls onDismiss on Enter key', () => {
    const onDismiss = vi.fn()
    render(<DragHandle drag={makeDrag()} onDismiss={onDismiss} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Enter' })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss on Space key', () => {
    const onDismiss = vi.fn()
    render(<DragHandle drag={makeDrag()} onDismiss={onDismiss} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: ' ' })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does not call onDismiss on unrelated keys', () => {
    const onDismiss = vi.fn()
    render(<DragHandle drag={makeDrag()} onDismiss={onDismiss} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Tab' })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('fires drag.onTouchStart on touch start', () => {
    const drag = makeDrag()
    render(<DragHandle drag={drag} onDismiss={vi.fn()} />)
    fireEvent.touchStart(screen.getByRole('button', { name: 'Close' }))
    expect(drag.onTouchStart).toHaveBeenCalled()
  })

  it('fires drag.onMouseDown on mouse down', () => {
    const drag = makeDrag()
    render(<DragHandle drag={drag} onDismiss={vi.fn()} />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Close' }))
    expect(drag.onMouseDown).toHaveBeenCalled()
  })

  it('merges className onto the button', () => {
    render(<DragHandle drag={makeDrag()} onDismiss={vi.fn()} className="pt-3 pb-2 w-full" />)
    const btn = screen.getByRole('button', { name: 'Close' })
    expect(btn.className).toContain('pt-3')
    expect(btn.className).toContain('w-full')
  })

  it('renders the pill inside the button', () => {
    render(<DragHandle drag={makeDrag()} onDismiss={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Close' })
    const pill = btn.querySelector('[aria-hidden="true"]')
    expect(pill).toBeInTheDocument()
    expect(pill?.className).toContain('h-1')
    expect(pill?.className).toContain('w-10')
  })
})
