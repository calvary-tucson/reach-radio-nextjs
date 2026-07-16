import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

function Harness() {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef)
  return (
    <div ref={containerRef} tabIndex={-1}>
      <input aria-label="First" />
      <input aria-label="Last enabled" />
      <button disabled>Disabled trailing button</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('wraps Tab from the last enabled element to the first, skipping a disabled trailing element', () => {
    const { getByLabelText } = render(<Harness />)
    const first = getByLabelText('First')
    const lastEnabled = getByLabelText('Last enabled')
    lastEnabled.focus()
    fireEvent.keyDown(lastEnabled, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('wraps Shift+Tab from the first element to the last enabled element, skipping a disabled trailing element', () => {
    const { getByLabelText } = render(<Harness />)
    const first = getByLabelText('First')
    const lastEnabled = getByLabelText('Last enabled')
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastEnabled)
  })
})
