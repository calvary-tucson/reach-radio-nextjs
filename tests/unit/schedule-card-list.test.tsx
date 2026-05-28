import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleCardList } from '@/components/teachers/ScheduleCardList'
import type { ScheduleSlot } from '@/lib/teachers/schedule'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

function makeTeacher(slug: string, name: string): TeacherWithSchedule {
  return { slug, name, title: null, photo: null, schedule: [] }
}

function makeShowSlot(teacher: TeacherWithSchedule, startMinutes: number, endMinutes: number): ScheduleSlot {
  return { type: 'show', teacher, startMinutes, endMinutes }
}

function makeMusicSlot(startMinutes: number, endMinutes: number): ScheduleSlot {
  return { type: 'music', startMinutes, endMinutes }
}

describe('ScheduleCardList', () => {
  it('renders "No shows" when slots is empty', () => {
    render(<ScheduleCardList slots={[]} currentTime={0} onSelect={vi.fn()} />)
    expect(screen.getByText(/no shows/i)).toBeInTheDocument()
  })

  it('renders a button for each show slot', () => {
    const slots: ScheduleSlot[] = [
      makeShowSlot(makeTeacher('a', 'Alice'), 540, 600),
      makeShowSlot(makeTeacher('b', 'Bob'), 600, 660),
    ]
    render(<ScheduleCardList slots={slots} currentTime={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('calls onSelect with the teacher when a show card is clicked', async () => {
    const onSelect = vi.fn()
    const teacher = makeTeacher('a', 'Alice')
    const slots: ScheduleSlot[] = [makeShowSlot(teacher, 540, 600)]
    render(<ScheduleCardList slots={slots} currentTime={0} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Alice'))
    expect(onSelect).toHaveBeenCalledWith(teacher)
  })

  it('renders a music gap row with data-testid="music-gap"', () => {
    const slots: ScheduleSlot[] = [makeMusicSlot(600, 660)]
    render(<ScheduleCardList slots={slots} currentTime={0} onSelect={vi.fn()} />)
    expect(screen.getByTestId('music-gap')).toBeInTheDocument()
  })

  it('highlights the active show when currentTime is within its range', () => {
    const slots: ScheduleSlot[] = [
      makeShowSlot(makeTeacher('a', 'Alice'), 540, 600), // 9:00–10:00 AM
      makeShowSlot(makeTeacher('b', 'Bob'), 600, 660),   // 10:00–11:00 AM
    ]
    render(<ScheduleCardList slots={slots} currentTime={570} onSelect={vi.fn()} />)
    // Alice's card should have active styling
    const aliceBtn = screen.getByRole('button', { name: /alice/i })
    expect(aliceBtn.className).toContain('border')
  })

  it('does not highlight any show when currentTime is -1', () => {
    const slots: ScheduleSlot[] = [makeShowSlot(makeTeacher('a', 'Alice'), 540, 600)]
    render(<ScheduleCardList slots={slots} currentTime={-1} onSelect={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /alice/i })
    expect(btn.className).not.toContain('border-[rgba(132,184,79')
  })
})
