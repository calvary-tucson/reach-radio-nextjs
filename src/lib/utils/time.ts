import type { ScheduleDay } from '@/lib/sanity/types'

export function to24h(time: string): string {
  try {
    const [timeStr, period] = time.split(' ')
    if (!timeStr || !period) return '00:00'
    const [h, m] = timeStr.split(':')
    if (!h || !m) return '00:00'
    let hours = parseInt(h, 10)
    if (isNaN(hours)) return '00:00'
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    return `${hours.toString().padStart(2, '0')}:${m}`
  } catch {
    console.warn(`[time] Failed to parse: "${time}"`)
    return '00:00'
  }
}

export function toMinutes(time24: string): number {
  const parts = time24.split(':').map(Number)
  const h = parts[0]
  const m = parts[1]
  if (isNaN(h) || isNaN(m)) return 0
  return h * 60 + m
}

export function timeStringToMinutes(time: string): number {
  return toMinutes(to24h(time))
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

export function formatScheduleDays(days: string[]): string {
  const indices = days
    .map((d) => DAY_ORDER.indexOf(d))
    .filter((i) => i !== -1)
    .sort((a, b) => a - b)
  if (!indices.length) return ''

  const parts: string[] = []
  let runStart = indices[0]!
  let runEnd = indices[0]!

  for (let i = 1; i <= indices.length; i++) {
    const cur = indices[i]
    if (cur === runEnd + 1) {
      runEnd = cur
    } else {
      const startAbbr = DAY_ABBR[DAY_ORDER[runStart]!]!
      const endAbbr = DAY_ABBR[DAY_ORDER[runEnd]!]!
      parts.push(runEnd - runStart >= 2 ? `${startAbbr}–${endAbbr}` : runEnd > runStart ? `${startAbbr}, ${endAbbr}` : startAbbr)
      if (cur !== undefined) { runStart = cur; runEnd = cur }
    }
  }

  return parts.join(', ')
}

export function computeWeeklyMinutes(schedule: ScheduleDay[]): number {
  return schedule.reduce(
    (total, day) =>
      total +
      day.times.reduce((dayTotal, slot) => {
        const start = timeStringToMinutes(slot.startTime)
        const end = timeStringToMinutes(slot.endTime)
        return dayTotal + Math.max(0, end - start)
      }, 0),
    0
  )
}

export function formatTimeMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h < 12 ? 'AM' : 'PM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`
}

export function formatDuration(startMinutes: number, endMinutes: number): string {
  const mins = endMinutes - startMinutes
  if (mins < 60) return `${mins}m`
  const h = mins / 60
  return h === Math.floor(h) ? `${h}h` : `${h.toFixed(1)}h`
}
