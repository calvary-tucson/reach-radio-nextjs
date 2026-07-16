import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/teachers/search',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('TeacherSearchBar', () => {
  it('refocuses the input via focusWithoutScroll (preventScroll: true) when cleared', () => {
    render(<TeacherSearchBar />)
    const input = screen.getByLabelText('Search teachers') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'algebra' } })
    const focusSpy = vi.spyOn(input, 'focus')
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })
})
