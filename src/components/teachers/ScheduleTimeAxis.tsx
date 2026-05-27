'use client'

import { timeStringToMinutes } from '@/lib/utils/time'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

interface ParsedSlot {
  teacher: TeacherWithSchedule
  startMinutes: number
  endMinutes: number
}

interface Props {
  teachers: TeacherWithSchedule[]
  selectedDay: string
  onSelect: (teacher: TeacherWithSchedule) => void
}

const AXIS_START = 5 * 60   // 5:00 AM = 300 min
const AXIS_END   = 23 * 60  // 11:00 PM = 1380 min
const PX_PER_MIN = 1
const MIN_HEIGHT_PX = 32

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5) // 5..23

function formatHourLabel(hour: number): string {
  if (hour === 0)  return '12 AM'
  if (hour < 12)  return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

function groupIntoColumns(slots: ParsedSlot[]): ParsedSlot[][] {
  const columns: ParsedSlot[][] = []
  for (const slot of slots) {
    let placed = false
    for (const col of columns) {
      const last = col[col.length - 1]
      if (last && slot.startMinutes >= last.endMinutes) {
        col.push(slot)
        placed = true
        break
      }
    }
    if (!placed) columns.push([slot])
  }
  return columns
}

export function ScheduleTimeAxis({ teachers, selectedDay, onSelect }: Props) {
  const slots: ParsedSlot[] = teachers
    .flatMap((t) =>
      (t.schedule ?? [])
        .filter((s) => s.day === selectedDay)
        .flatMap((s) =>
          s.times.map((time) => ({
            teacher: t,
            startMinutes: timeStringToMinutes(time.startTime),
            endMinutes: timeStringToMinutes(time.endTime),
          }))
        )
    )
    .filter((s) => s.endMinutes > s.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)

  const columns = groupIntoColumns(slots)
  const numCols = Math.max(columns.length, 1)
  const totalHeight = (AXIS_END - AXIS_START) * PX_PER_MIN

  const gapBars: { startMin: number; endMin: number }[] = []
  for (let i = 0; i < slots.length - 1; i++) {
    const current = slots[i]
    const next = slots[i + 1]
    if (current && next) {
      const gap = next.startMinutes - current.endMinutes
      if (gap >= 5) {
        gapBars.push({ startMin: current.endMinutes, endMin: next.startMinutes })
      }
    }
  }

  return (
    <div className="overflow-y-auto max-h-[500px]">
      <div className="relative" style={{ height: totalHeight }}>
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute left-0 w-12 text-right pr-2 text-xs text-white/40 leading-none"
            style={{ top: (h * 60 - AXIS_START) * PX_PER_MIN - 6 }}
          >
            {formatHourLabel(h)}
          </div>
        ))}

        {HOURS.map((h) => (
          <div
            key={`line-${h}`}
            className="absolute left-12 right-0 border-t border-white/5"
            style={{ top: (h * 60 - AXIS_START) * PX_PER_MIN }}
          />
        ))}

        <div className="absolute left-12 right-0 top-0 bottom-0">
          {slots.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-8">No shows scheduled for this day.</p>
          ) : (
            <>
              {gapBars.map((gap, i) => (
                <div
                  key={i}
                  data-testid="music-gap"
                  className="absolute inset-x-0 bg-white/3 rounded-[6px] flex items-center px-2"
                  style={{
                    top: (gap.startMin - AXIS_START) * PX_PER_MIN,
                    height: Math.max(MIN_HEIGHT_PX, (gap.endMin - gap.startMin) * PX_PER_MIN),
                  }}
                >
                  <span className="text-white/25 text-xs italic">♪ Music</span>
                </div>
              ))}

              {columns.map((col, colIdx) =>
                col.map((slot) => {
                  const topPx = (slot.startMinutes - AXIS_START) * PX_PER_MIN
                  const heightPx = Math.max(MIN_HEIGHT_PX, (slot.endMinutes - slot.startMinutes) * PX_PER_MIN)
                  const leftPct = (colIdx / numCols) * 100
                  const widthPct = (1 / numCols) * 100

                  return (
                    <button
                      key={`${slot.teacher.slug}-${slot.startMinutes}`}
                      type="button"
                      onClick={() => onSelect(slot.teacher)}
                      className="absolute flex items-center gap-1.5 bg-[rgba(132,184,79,0.12)] border-l-[3px] border-[#84b84f] hover:bg-[rgba(132,184,79,0.2)] active:bg-[rgba(132,184,79,0.2)] rounded-[8px] px-1.5 overflow-hidden transition-colors cursor-pointer"
                      style={{ top: topPx, height: heightPx, left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      <TeacherAvatar
                        name={slot.teacher.name}
                        photo={slot.teacher.photo}
                        lqip={slot.teacher.lqip ?? null}
                        size="xs"
                        shape="circle"
                        sizes="24px"
                      />
                      <span className="text-white/80 text-xs font-medium truncate leading-tight">
                        {slot.teacher.name}
                      </span>
                    </button>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
