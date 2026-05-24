import { describe, it, expect } from 'vitest'
import { filterTeachers } from '@/lib/teachers/filter'
import type { TeacherSummary } from '@/lib/sanity/types'

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
    expect(result.map((t) => t.slug)).toEqual(['jack-hibbs', 'jack-graham'])
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
