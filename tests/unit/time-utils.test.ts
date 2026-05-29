import { describe, it, expect } from 'vitest'
import { to24h, toMinutes, timeStringToMinutes, computeWeeklyMinutes, formatTimeMinutes, formatDuration } from '@/lib/utils/time'

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

describe('formatTimeMinutes', () => {
  it('formats midnight as 12:00 AM', () => {
    expect(formatTimeMinutes(0)).toBe('12:00 AM')
  })
  it('formats noon as 12:00 PM', () => {
    expect(formatTimeMinutes(720)).toBe('12:00 PM')
  })
  it('formats 1:00 PM (780 min)', () => {
    expect(formatTimeMinutes(780)).toBe('1:00 PM')
  })
  it('formats 9:30 AM (570 min)', () => {
    expect(formatTimeMinutes(570)).toBe('9:30 AM')
  })
  it('formats 11:59 PM (1439 min)', () => {
    expect(formatTimeMinutes(1439)).toBe('11:59 PM')
  })
})

describe('formatDuration', () => {
  it('formats sub-hour as minutes', () => {
    expect(formatDuration(0, 30)).toBe('30m')
  })
  it('formats exact hours', () => {
    expect(formatDuration(0, 60)).toBe('1h')
    expect(formatDuration(0, 120)).toBe('2h')
  })
  it('formats fractional hours', () => {
    expect(formatDuration(0, 90)).toBe('1.5h')
  })
})
