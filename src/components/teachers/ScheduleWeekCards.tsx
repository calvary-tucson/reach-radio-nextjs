'use client'

import { useMemo } from 'react'
import { buildDaySlots } from '@/lib/teachers/schedule'
import { ScheduleCardList } from './ScheduleCardList'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  Sunday: 'SUN', Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
  Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT',
}

interface Props {
  scheduleTeachers: TeacherWithSchedule[]
  /** Minutes since midnight in Phoenix TZ. -1 disables "on air now". */
  currentTime: number
  /** Full day name for today, e.g. "Monday". */
  today: string
  onSelect: (teacher: TeacherWithSchedule) => void
}

export function ScheduleWeekCards({ scheduleTeachers, currentTime, today, onSelect }: Props) {
  const slotsByDay = useMemo(
    () => Object.fromEntries(DAYS.map((day) => [day, buildDaySlots(scheduleTeachers, day)])),
    [scheduleTeachers]
  )

  return (
    <div className="grid grid-cols-7 gap-2">
      {DAYS.map((day) => {
        const isToday = day === today
        return (
          <div key={day} className="min-w-0">
            <div
              className={`text-center text-[11px] font-bold pb-2 mb-2 border-b ${
                isToday
                  ? 'text-[#84b84f] border-[rgba(132,184,79,0.25)]'
                  : 'text-white/40 border-white/[0.06]'
              }`}
            >
              {DAY_LABELS[day]}
              {isToday && <span className="ml-1 text-[8px]">●</span>}
            </div>
            <ScheduleCardList
              slots={slotsByDay[day] ?? []}
              currentTime={isToday ? currentTime : -1}
              onSelect={onSelect}
              compact
            />
          </div>
        )
      })}
    </div>
  )
}
