import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PassiveSearchBar } from '@/components/global/PassiveSearchBar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('@/lib/stores/modal', () => ({
  useModalStore: (selector: (s: { openModal: () => void; setTriggerRef: () => void }) => unknown) =>
    selector({ openModal: vi.fn(), setTriggerRef: vi.fn() }),
}))

vi.mock('@/lib/stores/navigation-store', () => ({
  useNavigationStore: (selector: (s: { reset: () => void }) => unknown) =>
    selector({ reset: vi.fn() }),
}))

describe('PassiveSearchBar', () => {
  it('renders placeholder text', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />)
    expect(screen.getByText('Search teachers...')).toBeInTheDocument()
  })

  it('renders a link pointing to the provided href', () => {
    render(<PassiveSearchBar href="/teachers/search" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/teachers/search')
  })

  it('link has cursor-pointer class', () => {
    render(<PassiveSearchBar href="/teachers/search" />)
    expect(screen.getByRole('link').className).toContain('cursor-pointer')
  })
})
