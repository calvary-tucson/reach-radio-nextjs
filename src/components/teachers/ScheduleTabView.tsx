'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { buildDaySlots, DAYS_ORDER, DAY_LABELS } from '@/lib/teachers/schedule'
import { ScheduleCardList } from './ScheduleCardList'
import { ScheduleWeekCards } from './ScheduleWeekCards'
import { useModalStore } from '@/lib/stores/modal'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'America/Phoenix'

interface Props {
  scheduleTeachers: TeacherWithSchedule[]
}

export function ScheduleTabView({ scheduleTeachers }: Props) {
  const now = dayjs().tz(TZ)
  const today = now.format('dddd')
  const currentTime = now.hour() * 60 + now.minute()

  const router = useRouter()
  const openModal = useModalStore((s) => s.openModal)
  const [selectedDay, setSelectedDay] = useState(today)

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

  const handleSelect = useCallback(
    (teacher: TeacherWithSchedule) => {
      openModal(teacher.name)
      router.push(`/teachers/${teacher.slug}`)
    },
    [openModal, router]
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
        <div className="relative mb-4">
          <div
            role="tablist"
            aria-label="Schedule day"
            className="flex gap-[5px] overflow-x-auto pb-1 pr-12 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {DAYS_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={selectedDay === day}
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
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[oklch(24%_0.05_280)] to-transparent" />
        </div>

        <ScheduleCardList
          slots={daySlots}
          currentTime={selectedDay === today ? currentTime : -1}
          onSelect={handleSelect}
        />
      </div>

      {/* Wide desktop (≥ lg): 7-col week grid */}
      <div className="hidden lg:block">
        <ScheduleWeekCards
          scheduleTeachers={scheduleTeachers}
          currentTime={currentTime}
          today={today}
          onSelect={handleSelect}
        />
      </div>
    </>
  )
}
