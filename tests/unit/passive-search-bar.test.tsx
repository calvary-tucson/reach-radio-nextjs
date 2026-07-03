import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PassiveSearchBar } from '@/components/global/PassiveSearchBar'

const { pushMock, prefetchMock, openModalMock, setTriggerRefMock, pushModalMock, resetMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  prefetchMock: vi.fn(),
  openModalMock: vi.fn(),
  setTriggerRefMock: vi.fn(),
  pushModalMock: vi.fn(),
  resetMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, prefetch: prefetchMock }),
}))

vi.mock('@/lib/stores/modal', () => {
  const state = {
    isOpen: false,
    openModal: openModalMock,
    setTriggerRef: setTriggerRefMock,
    pushModal: pushModalMock,
  }
  function useModalStore(selector: (s: typeof state) => unknown) {
    return selector(state)
  }
  useModalStore.getState = () => state
  return { useModalStore }
})

vi.mock('@/lib/stores/navigation-store', () => ({
  useNavigationStore: (selector: (s: { reset: () => void }) => unknown) =>
    selector({ reset: resetMock }),
}))

describe('PassiveSearchBar', () => {
  it('renders placeholder text', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />)
    expect(screen.getByPlaceholderText('Search teachers...')).toBeInTheDocument()
  })

  it('renders a real input so iOS can show the keyboard on pointerdown', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />)
    const input = screen.getByRole('searchbox')
    expect(input.tagName).toBe('INPUT')
  })

  it('renders a link pointing to the provided href', () => {
    render(<PassiveSearchBar href="/teachers/search" />)
    expect(screen.getByRole('link', { hidden: true })).toHaveAttribute('href', '/teachers/search')
  })

  it('link has cursor-pointer class', () => {
    render(<PassiveSearchBar href="/teachers/search" />)
    expect(screen.getByRole('link', { hidden: true }).className).toContain('cursor-pointer')
  })

  it('navigates imperatively on pointerdown instead of relying on click bubbling', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />)
    fireEvent.pointerDown(screen.getByRole('searchbox'))
    expect(pushMock).toHaveBeenCalledWith('/teachers/search')
    expect(openModalMock).toHaveBeenCalled()
  })

  it('prefetches the href on mount so the sheet route is cached before tap', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />)
    expect(prefetchMock).toHaveBeenCalledWith('/teachers/search')
  })
})
