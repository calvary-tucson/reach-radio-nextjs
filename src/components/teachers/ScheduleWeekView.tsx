'use client'

import { useState } from 'react'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { timeStringToMinutes } from '@/lib/utils/time'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherDetailSheet } from '@/components/teachers/TeacherDetailSheet'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'America/Phoenix'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_LABELS: Record<string, string> = {
  Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
}

const START_HOUR = 5
const END_HOUR = 21
const PX_PER_HOUR = 60

interface TimeSlot {
  teacher: TeacherWithSchedule
  startMins: number
  endMins: number
  label: string
}

interface Props {
  scheduleTeachers: TeacherWithSchedule[]
}

export function ScheduleWeekView({ scheduleTeachers }: Props) {
  const today = dayjs().tz(TZ).format('dddd')
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithSchedule | null>(null)

  const totalPx = (END_HOUR - START_HOUR) * PX_PER_HOUR

  const slotsByDay = new Map<string, TimeSlot[]>()
  for (const day of DAYS) slotsByDay.set(day, [])

  for (const teacher of scheduleTeachers) {
    for (const schedDay of teacher.schedule) {
      const daySlots = slotsByDay.get(schedDay.day)
      if (!daySlots) continue
      for (const t of schedDay.times) {
        daySlots.push({
          teacher,
          startMins: timeStringToMinutes(t.startTime),
          endMins: timeStringToMinutes(t.endTime),
          label: `${t.startTime} – ${t.endTime}`,
        })
      }
    }
  }

  for (const [, slots] of slotsByDay) {
    slots.sort((a, b) => a.startMins - b.startMins)
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  return (
    <>
      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: '700px' }}>
          {/* Time axis */}
          <div className="w-12 flex-shrink-0 pt-8" style={{ position: 'relative', height: totalPx + 32 }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute text-[9px] text-white/30 pr-1 text-right w-full"
                style={{ top: (h - START_HOUR) * PX_PER_HOUR - 6 }}
              >
                {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 gap-px">
            {DAYS.map((day) => {
              const isToday = day === today
              const slots = slotsByDay.get(day) ?? []
              return (
                <div key={day} className="flex-1 min-w-0">
                  {/* Day header */}
                  <div
                    className={`py-2 text-center text-[11px] font-bold mb-1 rounded-t-lg ${
                      isToday ? 'text-[#84b84f] bg-[rgba(132,184,79,0.08)]' : 'text-white/40'
                    }`}
                  >
                    {DAY_LABELS[day]}
                    {isToday && <span className="ml-1 text-[8px] text-[#84b84f]">●</span>}
                  </div>

                  {/* Slot column */}
                  <div
                    className={`relative rounded-b-lg ${isToday ? 'bg-[rgba(132,184,79,0.04)]' : 'bg-white/[0.02]'}`}
                    style={{ height: totalPx }}
                  >
                    {/* Hour grid lines */}
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-white/[0.04]"
                        style={{ top: (h - START_HOUR) * PX_PER_HOUR }}
                      />
                    ))}

                    {/* Slots */}
                    {slots.map((slot, i) => {
                      // Skip slots outside our window
                      if (slot.startMins >= END_HOUR * 60 || slot.endMins <= START_HOUR * 60) return null

                      const clampedStart = Math.max(slot.startMins, START_HOUR * 60)
                      const clampedEnd = Math.min(slot.endMins, END_HOUR * 60)
                      const topPx = (clampedStart - START_HOUR * 60) * (PX_PER_HOUR / 60)
                      const heightPx = Math.max(16, (clampedEnd - clampedStart) * (PX_PER_HOUR / 60))

                      return (
                        <button
                          key={`${slot.teacher.slug}-${slot.label}-${i}`}
                          type="button"
                          onClick={() => setSelectedTeacher(slot.teacher)}
                          className="absolute inset-x-0.5 rounded-[6px] bg-[rgba(132,184,79,0.12)] border-l-2 border-[#84b84f] hover:bg-[rgba(132,184,79,0.22)] transition-colors cursor-pointer text-left overflow-hidden px-1 py-0.5"
                          style={{ top: topPx, height: heightPx }}
                          aria-label={`${slot.teacher.name} ${slot.label}`}
                        >
                          <div className="flex items-center gap-0.5">
                            <TeacherAvatar
                              name={slot.teacher.name}
                              photo={slot.teacher.photo}
                              lqip={slot.teacher.lqip ?? null}
                              size="xs"
                              shape="circle"
                              sizes="24px"
                            />
                            {heightPx > 24 && (
                              <span className="text-[8px] text-white/70 font-medium truncate leading-tight">
                                {slot.teacher.name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <TeacherDetailSheet
        teacher={selectedTeacher}
        open={selectedTeacher !== null}
        onClose={() => setSelectedTeacher(null)}
      />
    </>
  )
}
