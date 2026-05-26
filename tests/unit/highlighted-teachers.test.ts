import { describe, it, expect } from 'vitest'
import {
  HIGHLIGHTED_TEACHER_SLUGS,
  sortByHighlightedOrder,
} from '@/lib/teachers/highlighted'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'

const mockTeachers: TeacherSummary[] = [
  { name: 'David Guzik', slug: 'david-guzik', title: 'Calvary Chapel', photo: null, lqip: undefined },
  { name: 'Robert Furrow', slug: 'robert-furrow', title: 'RRBS', photo: null, lqip: undefined },
  { name: 'Gary Hamrick', slug: 'gary-hamrick', title: 'Cornerstone', photo: null, lqip: undefined },
]

describe('HIGHLIGHTED_TEACHER_SLUGS', () => {
  it('has robert-furrow as first entry', () => {
    expect(HIGHLIGHTED_TEACHER_SLUGS[0]).toBe('robert-furrow')
  })

  it('contains all 5 expected slugs', () => {
    expect(HIGHLIGHTED_TEACHER_SLUGS).toContain('david-guzik')
    expect(HIGHLIGHTED_TEACHER_SLUGS).toContain('ed-taylor')
    expect(HIGHLIGHTED_TEACHER_SLUGS).toContain('gary-hamrick')
    expect(HIGHLIGHTED_TEACHER_SLUGS).toContain('scott-richards')
    expect(HIGHLIGHTED_TEACHER_SLUGS).toHaveLength(5)
  })
})

describe('sortByHighlightedOrder', () => {
  it('places robert-furrow first', () => {
    const result = sortByHighlightedOrder(mockTeachers, HIGHLIGHTED_TEACHER_SLUGS)
    expect(result[0].slug).toBe('robert-furrow')
  })

  it('follows array order for remaining teachers', () => {
    const result = sortByHighlightedOrder(mockTeachers, HIGHLIGHTED_TEACHER_SLUGS)
    expect(result.map((t) => t.slug)).toEqual(['robert-furrow', 'david-guzik', 'gary-hamrick'])
  })

  it('omits slugs not found in teachers array', () => {
    const result = sortByHighlightedOrder(mockTeachers, HIGHLIGHTED_TEACHER_SLUGS)
    expect(result.every((t) => mockTeachers.some((m) => m.slug === t.slug))).toBe(true)
  })
})

describe('highlightedTeachersQuery', () => {
  it('filters by slug list', () => {
    expect(highlightedTeachersQuery).toContain('slug.current in $slugs')
  })
  it('projects name, slug, title, photo, lqip', () => {
    expect(highlightedTeachersQuery).toContain('"name"')
    expect(highlightedTeachersQuery).toContain('"slug"')
    expect(highlightedTeachersQuery).toContain('"photo"')
    expect(highlightedTeachersQuery).toContain('"lqip"')
  })
})
