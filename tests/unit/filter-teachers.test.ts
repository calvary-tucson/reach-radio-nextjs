import { describe, it, expect } from 'vitest'
import { filterTeachers } from '@/lib/teachers/filter'
import type { TeacherSummary, ScheduleDay } from '@/lib/sanity/types'

const teachers: TeacherSummary[] = [
  { name: 'Jack Hibbs', slug: 'jack-hibbs', title: 'Real Life Radio', photo: null },
  { name: 'Jack Graham', slug: 'jack-graham', title: 'Powerpoint', photo: null },
  { name: 'Alistair Begg', slug: 'alistair-begg', title: 'Truth For Life', photo: null },
  { name: 'John MacArthur', slug: 'john-macarthur', title: 'Grace to You', photo: null },
]

describe('filterTeachers', () => {
  it('returns all teachers when query is empty string', () => {
    expect(filterTeachers(teachers, '')).toHaveLength(4)
  })

  it('returns all teachers when query is whitespace only', () => {
    expect(filterTeachers(teachers, '   ')).toHaveLength(4)
  })

  it('filters by name, case-insensitive', () => {
    const result = filterTeachers(teachers, 'jack')
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.slug)).toEqual(['jack-graham', 'jack-hibbs'])
  })

  it('filters by title, case-insensitive', () => {
    const result = filterTeachers(teachers, 'truth')
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('alistair-begg')
  })

  it('filters by partial match in title', () => {
    const result = filterTeachers(teachers, 'grace')
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('john-macarthur')
  })

  it('returns empty array when no match', () => {
    expect(filterTeachers(teachers, 'xyz999')).toHaveLength(0)
  })

  it('handles teachers with empty title', () => {
    const noTitle: TeacherSummary[] = [
      { name: 'Test Teacher', slug: 'test', title: '', photo: null },
    ]
    const result = filterTeachers(noTitle, 'test')
    expect(result).toHaveLength(1)
  })

  it('does not mutate the input array', () => {
    const copy = [...teachers]
    filterTeachers(teachers, 'jack')
    expect(teachers).toEqual(copy)
  })
})

const scheduleMap = new Map<string, ScheduleDay[]>([
  ['jack-hibbs', [{ day: 'Monday', times: [{ startTime: '9:00 AM', endTime: '9:30 AM' }] }]],
  ['jack-graham', [{ day: 'Wednesday', times: [{ startTime: '6:00 PM', endTime: '6:30 PM' }] }]],
  ['alistair-begg', [{ day: 'Monday', times: [{ startTime: '10:00 AM', endTime: '10:30 AM' }] }]],
])

const hoursMap = new Map<string, number>([
  ['jack-hibbs', 60],
  ['jack-graham', 120],
  ['alistair-begg', 30],
  ['john-macarthur', 0],
])

describe('filterTeachers with sort', () => {
  it('sorts by name-desc', () => {
    const result = filterTeachers(teachers, '', { sort: 'name-desc' })
    expect(result.map((t) => t.slug)).toEqual([
      'john-macarthur',
      'jack-hibbs',
      'jack-graham',
      'alistair-begg',
    ])
  })

  it('sorts by most-on-air descending', () => {
    const result = filterTeachers(teachers, '', { sort: 'most-on-air', hoursMap })
    expect(result.map((t) => t.slug)).toEqual([
      'jack-graham',
      'jack-hibbs',
      'alistair-begg',
      'john-macarthur',
    ])
  })

  it('sorts A-Z by default when no sort specified', () => {
    const result = filterTeachers(teachers, '')
    expect(result.map((t) => t.slug)).toEqual([
      'alistair-begg',
      'jack-graham',
      'jack-hibbs',
      'john-macarthur',
    ])
  })
})

describe('filterTeachers with day filter', () => {
  it('shows teachers airing on selected day', () => {
    const result = filterTeachers(teachers, '', { days: ['Monday'], scheduleMap })
    expect(result.map((t) => t.slug)).toContain('jack-hibbs')
    expect(result.map((t) => t.slug)).toContain('alistair-begg')
    expect(result.map((t) => t.slug)).not.toContain('jack-graham')
  })

  it('uses OR logic for multiple days', () => {
    const result = filterTeachers(teachers, '', {
      days: ['Monday', 'Wednesday'],
      scheduleMap,
    })
    expect(result.map((t) => t.slug)).toContain('jack-hibbs')
    expect(result.map((t) => t.slug)).toContain('jack-graham')
    expect(result.map((t) => t.slug)).toContain('alistair-begg')
  })

  it('returns empty when no teachers match day filter', () => {
    const result = filterTeachers(teachers, '', { days: ['Sunday'], scheduleMap })
    expect(result).toHaveLength(0)
  })

  it('ignores day filter when scheduleMap is not provided', () => {
    const result = filterTeachers(teachers, '', { days: ['Monday'] })
    expect(result).toHaveLength(4)
  })
})
