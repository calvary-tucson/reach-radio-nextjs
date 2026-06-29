import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSearchParams } from 'next/navigation'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: () => '/teachers/search',
}))

describe('TeacherSortControl', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
  })

  it('renders Sort button when no filters active', () => {
    render(<TeacherSortControl />)
    expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument()
  })

  it('clicking Sort calls router.replace with sort=name-asc', async () => {
    const user = userEvent.setup()
    render(<TeacherSortControl />)
    await user.click(screen.getByRole('button', { name: /sort/i }))
    expect(mockReplace).toHaveBeenCalledWith('/teachers/search?sort=name-asc')
  })

  it('clicking Sort a second time (sort=name-asc) calls router.replace with sort=name-desc', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('sort=name-asc') as ReturnType<typeof useSearchParams>)
    const user = userEvent.setup()
    render(<TeacherSortControl />)
    await user.click(screen.getByRole('button', { name: /sort/i }))
    expect(mockReplace).toHaveBeenCalledWith('/teachers/search?sort=name-desc')
  })

  it('clicking Sort on the last option (sort=most-on-air) calls router.replace with no sort param', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('sort=most-on-air') as ReturnType<typeof useSearchParams>)
    const user = userEvent.setup()
    render(<TeacherSortControl />)
    await user.click(screen.getByRole('button', { name: /sort/i }))
    expect(mockReplace).toHaveBeenCalledWith('/teachers/search')
  })

  it('Clear all button renders when days filter is active (no sort needed)', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('days=Monday') as ReturnType<typeof useSearchParams>)
    render(<TeacherSortControl />)
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()
  })

  it('clicking Clear all calls router.replace with just pathname, no params', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('days=Monday') as ReturnType<typeof useSearchParams>)
    const user = userEvent.setup()
    render(<TeacherSortControl />)
    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(mockReplace).toHaveBeenCalledWith('/teachers/search')
  })
})
