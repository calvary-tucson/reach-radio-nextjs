import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/teachers/search',
}))

describe('TeacherSortControl', () => {
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
})
