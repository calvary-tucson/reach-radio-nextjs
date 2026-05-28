'use client'

import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { TeacherDetailSheet } from './TeacherDetailSheet'
import { TeacherDetailPanel } from './TeacherDetailPanel'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { buildDaySlots } from '@/lib/teachers/schedule'
import { ScheduleCardList } from './ScheduleCardList'
import { ScheduleWeekCards } from './ScheduleWeekCards'
import { useIsMinMd } from '@/hooks/useIsMinMd'
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
  const now = dayjs().tz(TZ)
  const today = now.format('dddd')
  const currentTime = now.hour() * 60 + now.minute()

  const isMinMd = useIsMinMd()
  const [selectedDay, setSelectedDay] = useState(today)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithSchedule | null>(null)

  const mostOnAir = useMemo(() => {
    if (scheduleTeachers.length === 0) return null
    let best: { teacher: TeacherWithSchedule; minutes: number } | null = null
    for (const t of scheduleTeachers) {
      const mins = computeWeeklyMinutes(t.schedule)
      if (!best || mins > best.minutes || (mins === best.minutes && t.name < best.teacher.name)) {
        best = { teacher: t, minutes: mins }
      }
    }
    return best && best.minutes > 0 ? best : null
  }, [scheduleTeachers])

  const daySlots = useMemo(
    () => buildDaySlots(scheduleTeachers, selectedDay),
    [scheduleTeachers, selectedDay]
  )

  return (
    <>
      {mostOnAir && (
        <div className="flex items-center gap-2 mb-3 bg-[rgba(132,184,79,0.08)] border border-[rgba(132,184,79,0.18)] rounded-[12px] px-3 py-2">
          <TeacherAvatar
            name={mostOnAir.teacher.name}
            photo={mostOnAir.teacher.photo}
            lqip={mostOnAir.teacher.lqip ?? null}
            size="xs"
            shape="circle"
            sizes="24px"
          />
          <span className="text-xs text-white/55">
            Most on air:{' '}
            <span className="text-white font-semibold">{mostOnAir.teacher.name}</span>
            {' · '}
            <span>{Math.round(mostOnAir.minutes / 60)} hrs / wk</span>
          </span>
        </div>
      )}

      {/* Mobile + narrow desktop (< lg): day tabs + card list */}
      <div className="lg:hidden">
        <div className="flex gap-[5px] overflow-x-auto pb-1 mb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`flex-shrink-0 px-4 py-[5px] rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                selectedDay === day
                  ? 'bg-[#84b84f] text-[#0a1505]'
                  : 'bg-[#1e2328] text-white/50 hover:bg-[#262d34] hover:text-white/70'
              }`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>

        <ScheduleCardList
          slots={daySlots}
          currentTime={selectedDay === today ? currentTime : -1}
          onSelect={setSelectedTeacher}
        />

        {/* < md: bottom sheet — gated with JS because createPortal bypasses CSS hidden */}
        <div className="md:hidden">
          <TeacherDetailSheet
            teacher={selectedTeacher}
            open={!isMinMd && selectedTeacher !== null}
            onClose={() => setSelectedTeacher(null)}
          />
        </div>

        {/* md–lg: right overlay panel — gated with JS because createPortal bypasses CSS hidden */}
        <div className="hidden md:block">
          <TeacherDetailPanel
            teacher={selectedTeacher}
            open={isMinMd && selectedTeacher !== null}
            onClose={() => setSelectedTeacher(null)}
          />
        </div>
      </div>

      {/* Wide desktop (≥ lg): 7-col week grid */}
      <div className="hidden lg:block">
        <ScheduleWeekCards
          scheduleTeachers={scheduleTeachers}
          currentTime={currentTime}
          today={today}
          onSelect={setSelectedTeacher}
        />
        <TeacherDetailPanel
          teacher={selectedTeacher}
          open={isMinMd && selectedTeacher !== null}
          onClose={() => setSelectedTeacher(null)}
        />
      </div>
    </>
  )
}
