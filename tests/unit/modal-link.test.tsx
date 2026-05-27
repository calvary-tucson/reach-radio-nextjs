import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModalLink } from '@/components/modals/ModalLink'

vi.mock('next/navigation', () => ({
  usePathname: () => '/teachers',
}))

vi.mock('@/lib/stores/modal', () => ({
  useModalStore: (selector: (s: { openModal: () => void; setTriggerRef: () => void }) => unknown) =>
    selector({ openModal: vi.fn(), setTriggerRef: vi.fn() }),
}))

vi.mock('@/lib/stores/navigation-store', () => ({
  useNavigationStore: (selector: (s: { reset: () => void }) => unknown) =>
    selector({ reset: vi.fn() }),
}))

describe('ModalLink', () => {
  it('renders an anchor element', () => {
    render(
      <ModalLink href="/teachers/search" modalTitle="Search Teachers">
        <span>Search</span>
      </ModalLink>
    )
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <ModalLink href="/teachers/search">
        <span>Search teachers</span>
      </ModalLink>
    )
    expect(screen.getByText('Search teachers')).toBeInTheDocument()
  })
})
