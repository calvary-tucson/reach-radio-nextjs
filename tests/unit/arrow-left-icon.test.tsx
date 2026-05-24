import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArrowLeftIcon } from '@/components/icons/ArrowLeftIcon'

describe('ArrowLeftIcon', () => {
  it('renders an svg element', () => {
    const { container } = render(<ArrowLeftIcon />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('svg is aria-hidden by default', () => {
    const { container } = render(<ArrowLeftIcon />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('accepts a className prop', () => {
    const { container } = render(<ArrowLeftIcon className="w-4 h-4" />)
    expect(container.querySelector('svg')).toHaveClass('w-4', 'h-4')
  })
})
