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
