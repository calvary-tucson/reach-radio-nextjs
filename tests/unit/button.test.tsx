import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('has cursor-pointer class', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveClass('cursor-pointer')
  })

  it('renders disabled state with cursor-not-allowed', () => {
    render(<Button disabled>Click me</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveClass('cursor-not-allowed')
  })

  it('renders as child element with asChild', () => {
    render(
      <Button asChild>
        <Link href="/test">Link</Link>
      </Button>
    )
    expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-600')
  })
})
