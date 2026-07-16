import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { ContactState } from '@/actions/contact'

// Mock useActionState before importing ContactForm
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

function mockState(state: ContactState) {
  vi.mocked(useActionState).mockReturnValue([state, vi.fn(), false] as never)
}

describe('ContactForm onSuccess', () => {
  beforeEach(() => {
    mockState({ success: false })
  })

  it('calls onSuccess when submission succeeds', async () => {
    const onSuccess = vi.fn()
    mockState({ success: false })
    const { rerender } = render(<ContactForm onSuccess={onSuccess} />)
    mockState({ success: true })
    rerender(<ContactForm onSuccess={onSuccess} />)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('does not throw when onSuccess is not provided', async () => {
    mockState({ success: true })
    expect(() => render(<ContactForm />)).not.toThrow()
  })

  it('does not call onSuccess when success is false', async () => {
    mockState({ success: false })
    const onSuccess = vi.fn()
    render(<ContactForm onSuccess={onSuccess} />)
    await waitFor(() => {}, { timeout: 50 }).catch(() => {})
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
