import { describe, it, expect } from 'vitest'
import { to24h, toMinutes, timeStringToMinutes, computeWeeklyMinutes } from '@/lib/utils/time'

describe('to24h', () => {
  it('converts AM times', () => {
    expect(to24h('9:00 AM')).toBe('09:00')
    expect(to24h('12:00 AM')).toBe('00:00')
    expect(to24h('11:30 AM')).toBe('11:30')
  })
  it('converts PM times', () => {
    expect(to24h('12:00 PM')).toBe('12:00')
    expect(to24h('1:00 PM')).toBe('13:00')
    expect(to24h('6:30 PM')).toBe('18:30')
  })
  it('returns 00:00 for invalid input', () => {
    expect(to24h('invalid')).toBe('00:00')
  })
})

describe('toMinutes', () => {
  it('converts 24h time to total minutes', () => {
    expect(toMinutes('09:00')).toBe(540)
    expect(toMinutes('18:30')).toBe(1110)
    expect(toMinutes('00:00')).toBe(0)
  })
})

describe('timeStringToMinutes', () => {
  it('converts time strings to total minutes', () => {
    expect(timeStringToMinutes('9:00 AM')).toBe(540)
    expect(timeStringToMinutes('6:30 PM')).toBe(1110)
  })
})

describe('computeWeeklyMinutes', () => {
  it('sums durations across all days', () => {
    const schedule = [
      { day: 'Monday', times: [{ startTime: '9:00 AM', endTime: '9:30 AM' }] },
      { day: 'Wednesday', times: [{ startTime: '6:00 PM', endTime: '6:30 PM' }] },
    ]
    expect(computeWeeklyMinutes(schedule)).toBe(60)
  })
  it('handles multiple slots in same day', () => {
    const schedule = [
      {
        day: 'Monday',
        times: [
          { startTime: '9:00 AM', endTime: '9:30 AM' },
          { startTime: '6:00 PM', endTime: '6:30 PM' },
        ],
      },
    ]
    expect(computeWeeklyMinutes(schedule)).toBe(60)
  })
  it('returns 0 for empty schedule', () => {
    expect(computeWeeklyMinutes([])).toBe(0)
  })
  it('returns 0 for slots with reversed times', () => {
    const schedule = [{ day: 'Monday', times: [{ startTime: '9:30 AM', endTime: '9:00 AM' }] }]
    expect(computeWeeklyMinutes(schedule)).toBe(0)
  })
})
