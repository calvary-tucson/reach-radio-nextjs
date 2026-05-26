'use client'

import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { ScheduleTimeAxis } from './ScheduleTimeAxis'
import { TeacherDetailSheet } from './TeacherDetailSheet'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'America/Phoenix'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_LABELS: Record<string, string> = {
  Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
}

interface Props {
  scheduleTeachers: TeacherWithSchedule[]
}

export function ScheduleTabView({ scheduleTeachers }: Props) {
  const today = dayjs().tz(TZ).format('dddd')
  const [selectedDay, setSelectedDay] = useState(today)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithSchedule | null>(null)

  const mostOnAir = useMemo(() => {
    if (scheduleTeachers.length === 0) return null
    let best: { teacher: TeacherWithSchedule; minutes: number } | null = null
    for (const t of scheduleTeachers) {
      const mins = computeWeeklyMinutes(t.schedule)
      if (
        !best ||
        mins > best.minutes ||
        (mins === best.minutes && t.name < best.teacher.name)
      ) {
        best = { teacher: t, minutes: mins }
      }
    }
    return best && best.minutes > 0 ? best : null
  }, [scheduleTeachers])

  return (
    <>
      {mostOnAir && (
        <div className="flex items-center gap-2 px-1 mb-3 text-sm text-white/60">
          <span>Most on air:</span>
          <span className="text-white font-medium">{mostOnAir.teacher.name}</span>
          <span>·</span>
          <span>{Math.round(mostOnAir.minutes / 60)} hrs / wk</span>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              selectedDay === day
                ? 'bg-[var(--color-brand-green)] text-white'
                : 'bg-gray-700 text-white/70 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>

      <ScheduleTimeAxis
        teachers={scheduleTeachers}
        selectedDay={selectedDay}
        onSelect={setSelectedTeacher}
      />

      <TeacherDetailSheet
        teacher={selectedTeacher}
        open={selectedTeacher !== null}
        onClose={() => setSelectedTeacher(null)}
      />
    </>
  )
}
