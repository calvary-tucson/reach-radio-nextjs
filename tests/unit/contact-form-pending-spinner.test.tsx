import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ContactState } from '@/actions/contact'

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useActionState: vi.fn() }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/actions/contact', () => ({
  submitContact: vi.fn(),
}))

import { useActionState } from 'react'
import { ContactForm } from '@/components/about/ContactForm'

function mockState(state: ContactState, isPending: boolean) {
  vi.mocked(useActionState).mockReturnValue([state, vi.fn(), isPending] as never)
}

describe('ContactForm — submit pending state', () => {
  beforeEach(() => {
    mockState({ success: false }, false)
  })

  it('shows a spinner alongside the submit button while pending', () => {
    mockState({ success: false }, true)
    render(<ContactForm />)
    expect(screen.getByRole('status')).toHaveTextContent(/sending/i)
  })

  it('does not show a spinner when not pending', () => {
    mockState({ success: false }, false)
    render(<ContactForm />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
