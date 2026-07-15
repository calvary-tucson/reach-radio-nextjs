'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { ChevronDown, Check } from 'lucide-react'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { buildDaySlots, DAYS_ORDER } from '@/lib/teachers/schedule'
import { ScheduleCardList } from './ScheduleCardList'
import { ScheduleWeekCards } from './ScheduleWeekCards'
import { BottomSheet } from '@/components/global/BottomSheet'
import { useModalStore } from '@/lib/stores/modal'
import { useHideMediaBarWhileOpen } from '@/lib/hooks/useHideMediaBarWhileOpen'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'America/Phoenix'

interface ScheduleTabViewProps {
  scheduleTeachers: TeacherWithSchedule[]
}

export function ScheduleTabView({ scheduleTeachers }: ScheduleTabViewProps) {
  const [nowDayjs, setNowDayjs] = useState(() => dayjs().tz(TZ))
  const today = nowDayjs.format('dddd')
  const currentTime = nowDayjs.hour() * 60 + nowDayjs.minute()

  useEffect(() => {
    const id = setInterval(() => setNowDayjs(dayjs().tz(TZ)), 60_000)
    return () => clearInterval(id)
  }, [])

  const router = useRouter()
  const openModal = useModalStore((s) => s.openModal)
  const [selectedDay, setSelectedDay] = useState(today)
  const [sheetOpen, setSheetOpen] = useState(false)

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

  useHideMediaBarWhileOpen(sheetOpen)

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
          <span className="text-xs text-white/55 light:text-gray-500">
            Most on air:{' '}
            <span className="text-white light:text-gray-900 font-semibold">{mostOnAir.teacher.name}</span>
            {' · '}
            <span>{Math.round(mostOnAir.minutes / 60)} hrs / wk</span>
          </span>
        </div>
      )}

      {/* Mobile + narrow desktop (< lg): day picker chip + card list */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2 mb-4 px-4 py-[7px] rounded-full bg-[#262d34] light:bg-gray-100 border border-white/20 light:border-gray-300 text-white light:text-gray-900 text-sm font-semibold cursor-pointer"
        >
          <span>{selectedDay === today ? `Today — ${selectedDay}` : selectedDay}</span>
          <ChevronDown className="h-3.5 w-3.5 text-white/50 light:text-gray-400" aria-hidden="true" />
        </button>

        <ScheduleCardList
          slots={daySlots}
          currentTime={selectedDay === today ? currentTime : -1}
          onSelect={handleSelect}
        />

        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          ariaLabel="Pick a day"
        >
          <div className="px-4 pb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40 light:text-gray-400 mb-3">
              Pick a day
            </p>
            <ul
              role="listbox"
              aria-label="Day"
              onKeyDown={(e) => {
                const idx = DAYS_ORDER.indexOf(selectedDay)
                if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedDay(DAYS_ORDER[(idx + 1) % DAYS_ORDER.length]) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedDay(DAYS_ORDER[(idx - 1 + DAYS_ORDER.length) % DAYS_ORDER.length]) }
              }}
            >
              {DAYS_ORDER.map((day) => (
                <li key={day} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedDay === day}
                    onClick={() => { setSelectedDay(day); setSheetOpen(false) }}
                    className="flex items-center gap-3 w-full px-2 py-3 rounded-lg text-sm font-medium cursor-pointer motion-safe:transition-colors hover:bg-white/5 light:hover:bg-gray-50 active:bg-white/10 light:active:bg-gray-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Check
                      className={`h-4 w-4 shrink-0 text-[#84b84f] motion-safe:transition-opacity ${selectedDay === day ? 'opacity-100' : 'opacity-0'}`}
                      aria-hidden="true"
                    />
                    <span className={selectedDay === day ? 'text-white light:text-gray-900' : 'text-white/60 light:text-gray-500'}>
                      {day}
                      {day === today && <span className="ml-2 text-[#84b84f] text-xs">Today</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </BottomSheet>
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
