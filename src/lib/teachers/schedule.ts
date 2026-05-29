import { timeStringToMinutes } from '@/lib/utils/time'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

export const DAYS_ORDER: string[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_LABELS: Record<string, string> = {
  Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
}

export type ScheduleSlot =
  | { type: 'show'; teacher: TeacherWithSchedule; startMinutes: number; endMinutes: number }
  | { type: 'music'; startMinutes: number; endMinutes: number }

export function buildDaySlots(teachers: TeacherWithSchedule[], day: string): ScheduleSlot[] {
  const showSlots: Extract<ScheduleSlot, { type: 'show' }>[] = teachers
    .flatMap((t) =>
      (t.schedule ?? [])
        .filter((s) => s.day === day)
        .flatMap((s) =>
          s.times.map((time) => ({
            type: 'show' as const,
            teacher: t,
            startMinutes: timeStringToMinutes(time.startTime),
            endMinutes: timeStringToMinutes(time.endTime),
          }))
        )
    )
    .filter((s) => s.endMinutes > s.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)

  const result: ScheduleSlot[] = []
  for (let i = 0; i < showSlots.length; i++) {
    const current = showSlots[i]!
    result.push(current)
    const next = showSlots[i + 1]
    if (next && next.startMinutes - current.endMinutes >= 5) {
      result.push({ type: 'music', startMinutes: current.endMinutes, endMinutes: next.startMinutes })
    }
  }
  return result
}
