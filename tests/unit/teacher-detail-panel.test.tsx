import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherDetailPanel } from '@/components/teachers/TeacherDetailPanel'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

const teacher: TeacherWithSchedule = {
  slug: 'mike-robinson',
  name: 'Mike Robinson',
  title: 'Morning Show Host',
  photo: null,
  schedule: [{ day: 'Monday', times: [{ startTime: '6:00 AM', endTime: '8:00 AM' }] }],
}

describe('TeacherDetailPanel', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <TeacherDetailPanel teacher={teacher} open={false} onClose={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when teacher is null', () => {
    const { container } = render(
      <TeacherDetailPanel teacher={null} open={true} onClose={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders teacher name and title when open', () => {
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Mike Robinson')).toBeInTheDocument()
    expect(screen.getByText('Morning Show Host')).toBeInTheDocument()
  })

  it('renders weekly schedule', () => {
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText(/6:00 AM/)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 500 })
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={onClose} />)
    await userEvent.click(screen.getByTestId('teacher-detail-panel-backdrop'))
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 500 })
  })

  it('has a "View full profile" link pointing to the teacher slug', () => {
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: /view full profile/i })
    expect(link).toHaveAttribute('href', '/teachers/mike-robinson')
  })
})
