import { describe, it, expect } from 'vitest'
import { teacherListQuery, teacherDetailQuery, scheduleQuery, teacherSearchQuery, fullScheduleQuery } from '@/lib/sanity/queries'

describe('GROQ queries', () => {
  it('teacherListQuery is a non-empty string', () => {
    expect(typeof teacherListQuery).toBe('string')
    expect(teacherListQuery.length).toBeGreaterThan(0)
    expect(teacherListQuery).toContain('_type == "teacher"')
  })

  it('teacherDetailQuery includes slug param', () => {
    expect(teacherDetailQuery).toContain('$slug')
  })

  it('scheduleQuery includes day param', () => {
    expect(scheduleQuery).toContain('$day')
  })

  it('teacherListQuery includes lqip projection', () => {
    expect(teacherListQuery).toContain('lqip')
  })

  it('teacherDetailQuery includes lqip projection', () => {
    expect(teacherDetailQuery).toContain('lqip')
  })

  it('teacherSearchQuery includes lqip projection', () => {
    expect(teacherSearchQuery).toContain('lqip')
  })
})
