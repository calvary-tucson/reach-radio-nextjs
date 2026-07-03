import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PassiveSearchBar } from '@/components/global/PassiveSearchBar'

const { pushMock, prefetchMock, openSearchSheetMock, setTriggerRefMock, resetMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  prefetchMock: vi.fn(),
  openSearchSheetMock: vi.fn(),
  setTriggerRefMock: vi.fn(),
  resetMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, prefetch: prefetchMock }),
}))

vi.mock('@/lib/stores/modal', () => {
  const state = {
    setTriggerRef: setTriggerRefMock,
    openSearchSheet: openSearchSheetMock,
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
    expect(screen.getByText('Search teachers...')).toBeInTheDocument()
  })

  it('renders a real button (not a fake link) so there is no throwaway proxy input', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />)
    const button = screen.getByRole('button', { name: 'Search teachers...' })
    expect(button.tagName).toBe('BUTTON')
  })

  it('button has cursor-pointer class', () => {
    render(<PassiveSearchBar href="/teachers/search" />)
    expect(screen.getByRole('button').className).toContain('cursor-pointer')
  })

  it('opens the search sheet synchronously and syncs the URL on pointerdown', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." modalTitle="Search Teachers" />)
    fireEvent.pointerDown(screen.getByRole('button'))
    expect(openSearchSheetMock).toHaveBeenCalledWith('Search Teachers')
    expect(pushMock).toHaveBeenCalledWith('/teachers/search')
  })

  it('prefetches the href on mount so router.push resolves fast', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />)
    expect(prefetchMock).toHaveBeenCalledWith('/teachers/search')
  })
})
