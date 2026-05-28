import { describe, it, expect } from 'vitest'
import { buildDaySlots } from '@/lib/teachers/schedule'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

function makeTeacher(slug: string, name: string, day: string, times: { startTime: string; endTime: string }[]): TeacherWithSchedule {
  return { slug, name, title: null, photo: null, schedule: [{ day, times }] }
}

describe('buildDaySlots', () => {
  it('returns empty array when no teachers have shows on the given day', () => {
    const teachers = [makeTeacher('a', 'A', 'Monday', [{ startTime: '9:00 AM', endTime: '10:00 AM' }])]
    expect(buildDaySlots(teachers, 'Tuesday')).toEqual([])
  })

  it('returns show slots sorted by startMinutes', () => {
    const teachers = [
      makeTeacher('b', 'B', 'Monday', [{ startTime: '10:00 AM', endTime: '11:00 AM' }]),
      makeTeacher('a', 'A', 'Monday', [{ startTime: '9:00 AM', endTime: '10:00 AM' }]),
    ]
    const slots = buildDaySlots(teachers, 'Monday')
    expect(slots[0]).toMatchObject({ type: 'show', teacher: expect.objectContaining({ slug: 'a' }) })
    expect(slots[1]).toMatchObject({ type: 'show', teacher: expect.objectContaining({ slug: 'b' }) })
  })

  it('inserts a music gap between shows with a gap >= 5 minutes', () => {
    const teachers = [
      makeTeacher('a', 'A', 'Monday', [{ startTime: '9:00 AM', endTime: '10:00 AM' }]),
      makeTeacher('b', 'B', 'Monday', [{ startTime: '10:30 AM', endTime: '11:30 AM' }]),
    ]
    const slots = buildDaySlots(teachers, 'Monday')
    expect(slots).toHaveLength(3)
    expect(slots[1]).toMatchObject({ type: 'music', startMinutes: 600, endMinutes: 630 })
  })

  it('does not insert a music gap when shows are adjacent (< 5 min gap)', () => {
    const teachers = [
      makeTeacher('a', 'A', 'Monday', [{ startTime: '9:00 AM', endTime: '10:00 AM' }]),
      makeTeacher('b', 'B', 'Monday', [{ startTime: '10:03 AM', endTime: '11:00 AM' }]),
    ]
    const slots = buildDaySlots(teachers, 'Monday')
    expect(slots).toHaveLength(2)
    expect(slots.every((s) => s.type === 'show')).toBe(true)
  })

  it('filters out slots where endMinutes <= startMinutes', () => {
    const teachers = [makeTeacher('a', 'A', 'Monday', [{ startTime: '10:00 AM', endTime: '9:00 AM' }])]
    expect(buildDaySlots(teachers, 'Monday')).toEqual([])
  })

  it('collects slots from multiple teachers on the same day', () => {
    const teachers = [
      makeTeacher('a', 'A', 'Monday', [{ startTime: '6:00 AM', endTime: '8:00 AM' }]),
      makeTeacher('b', 'B', 'Monday', [{ startTime: '8:00 AM', endTime: '10:00 AM' }]),
    ]
    const slots = buildDaySlots(teachers, 'Monday')
    const showSlots = slots.filter((s) => s.type === 'show')
    expect(showSlots).toHaveLength(2)
  })
})
