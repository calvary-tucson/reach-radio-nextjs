import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleTimeAxis } from '@/components/teachers/ScheduleTimeAxis'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

const makeTeacher = (
  slug: string,
  name: string,
  startTime: string,
  endTime: string,
  day = 'Monday'
): TeacherWithSchedule => ({
  slug,
  name,
  title: 'Show Title',
  photo: null,
  schedule: [{ day, times: [{ startTime, endTime }] }],
})

describe('ScheduleTimeAxis', () => {
  it('renders a slot button for each scheduled teacher', () => {
    const teachers = [
      makeTeacher('teacher-a', 'Teacher A', '9:00 AM', '9:30 AM'),
      makeTeacher('teacher-b', 'Teacher B', '10:00 AM', '10:30 AM'),
    ]
    render(<ScheduleTimeAxis teachers={teachers} selectedDay="Monday" onSelect={vi.fn()} />)
    expect(screen.getByText('Teacher A')).toBeInTheDocument()
    expect(screen.getByText('Teacher B')).toBeInTheDocument()
  })

  it('calls onSelect with teacher data when slot clicked', async () => {
    const onSelect = vi.fn()
    const teacher = makeTeacher('teacher-a', 'Teacher A', '9:00 AM', '9:30 AM')
    render(<ScheduleTimeAxis teachers={[teacher]} selectedDay="Monday" onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Teacher A'))
    expect(onSelect).toHaveBeenCalledWith(teacher)
  })

  it('shows empty message when no teachers on selected day', () => {
    const teacher = makeTeacher('teacher-a', 'Teacher A', '9:00 AM', '9:30 AM', 'Tuesday')
    render(<ScheduleTimeAxis teachers={[teacher]} selectedDay="Monday" onSelect={vi.fn()} />)
    expect(screen.getByText(/no shows/i)).toBeInTheDocument()
  })

  it('renders hour tick labels', () => {
    render(<ScheduleTimeAxis teachers={[]} selectedDay="Monday" onSelect={vi.fn()} />)
    expect(screen.getByText('5 AM')).toBeInTheDocument()
    expect(screen.getByText('12 PM')).toBeInTheDocument()
    expect(screen.getByText('11 PM')).toBeInTheDocument()
  })

  it('renders a music gap bar for gaps >= 5 min', () => {
    const teachers = [
      makeTeacher('teacher-a', 'Teacher A', '9:00 AM', '9:30 AM'),
      makeTeacher('teacher-b', 'Teacher B', '10:00 AM', '10:30 AM'),
    ]
    render(<ScheduleTimeAxis teachers={teachers} selectedDay="Monday" onSelect={vi.fn()} />)
    expect(screen.getByTestId('music-gap')).toBeInTheDocument()
  })
})
