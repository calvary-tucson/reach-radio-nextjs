import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeacherDetailSheet } from '@/components/teachers/TeacherDetailSheet'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

const mockTeacher: TeacherWithSchedule = {
  name: 'Robert Furrow',
  slug: 'robert-furrow',
  title: 'RRBS',
  photo: null,
  schedule: [
    { day: 'Monday', times: [{ startTime: '9:00 AM', endTime: '9:30 AM' }] },
    { day: 'Wednesday', times: [{ startTime: '6:00 PM', endTime: '6:30 PM' }] },
  ],
}

describe('TeacherDetailSheet', () => {
  it('renders nothing when teacher is null', () => {
    render(<TeacherDetailSheet teacher={null} open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders teacher name and title when open', () => {
    render(<TeacherDetailSheet teacher={mockTeacher} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Robert Furrow')).toBeInTheDocument()
    expect(screen.getByText('RRBS')).toBeInTheDocument()
  })

  it('renders schedule days', () => {
    render(<TeacherDetailSheet teacher={mockTeacher} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Wednesday')).toBeInTheDocument()
  })

  it('renders view profile link to correct href', () => {
    render(<TeacherDetailSheet teacher={mockTeacher} open={true} onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: /view full profile/i })
    expect(link).toHaveAttribute('href', '/teachers/robert-furrow')
  })
})
