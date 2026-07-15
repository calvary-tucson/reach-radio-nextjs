'use client'

import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { formatTimeMinutes, formatDuration } from '@/lib/utils/time'
import type { TeacherWithSchedule } from '@/lib/sanity/types'
import type { ScheduleSlot } from '@/lib/teachers/schedule'

interface Props {
  slots: ScheduleSlot[]
  /** Minutes since midnight in Phoenix TZ. Pass -1 to disable "on air now" highlighting. */
  currentTime: number
  onSelect: (teacher: TeacherWithSchedule) => void
  /** Compact mode for narrow desktop columns: smaller avatar, tighter text. */
  compact?: boolean
}

export function ScheduleCardList({ slots, currentTime, onSelect, compact = false }: Props) {
  if (slots.length === 0) {
    return (
      <p className="text-white/50 light:text-gray-400 text-sm text-center py-8">No shows scheduled for this day.</p>
    )
  }

  const activeSlot = currentTime >= 0
    ? slots.find(
        (s): s is Extract<ScheduleSlot, { type: 'show' }> =>
          s.type === 'show' && s.startMinutes <= currentTime && currentTime < s.endMinutes
      )
    : undefined

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot) => {
        if (slot.type === 'music') {
          return (
            <div
              key={`music-${slot.startMinutes}`}
              data-testid="music-gap"
              className="bg-white/[0.025] light:bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-2"
            >
              <span className="text-white/25 light:text-gray-400 text-xs italic">♪ Music</span>
              <span className="text-white/20 light:text-gray-300 text-xs">
                {formatTimeMinutes(slot.startMinutes)} – {formatTimeMinutes(slot.endMinutes)}
              </span>
            </div>
          )
        }

        const isActive = slot === activeSlot
        const avatarSize = compact ? 'xs' : 'sm'
        const avatarPx = compact ? '24px' : '38px'

        return (
          <button
            key={`${slot.teacher.slug}-${slot.startMinutes}`}
            type="button"
            onClick={() => onSelect(slot.teacher)}
            aria-label={`${slot.teacher.name} ${formatTimeMinutes(slot.startMinutes)} to ${formatTimeMinutes(slot.endMinutes)}`}
            className={`rounded-xl text-left motion-safe:transition-colors cursor-pointer w-full ${
              compact ? 'px-2 py-2' : 'px-4 py-3'
            } ${
              isActive
                ? 'bg-[rgba(132,184,79,0.10)] border border-[rgba(132,184,79,0.25)] hover:bg-[rgba(132,184,79,0.14)]'
                : 'bg-white/[0.04] light:bg-gray-50 hover:bg-white/[0.07] light:hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <TeacherAvatar
                name={slot.teacher.name}
                photo={slot.teacher.photo}
                lqip={slot.teacher.lqip ?? null}
                size={avatarSize}
                shape="circle"
                sizes={avatarPx}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-white light:text-gray-900 font-semibold truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                  {slot.teacher.name}
                </p>
                <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${isActive ? 'text-[#84b84f]' : 'text-white/55 light:text-gray-500'}`}>
                  {formatTimeMinutes(slot.startMinutes)} – {formatTimeMinutes(slot.endMinutes)}
                </p>
              </div>
              {!compact && (
                <span className={`text-xs font-medium px-2 py-1 rounded-md flex-shrink-0 ${
                  isActive
                    ? 'text-[#84b84f] bg-[rgba(132,184,79,0.15)]'
                    : 'text-white/30 light:text-gray-400 bg-white/[0.06] light:bg-gray-100'
                }`}>
                  {formatDuration(slot.startMinutes, slot.endMinutes)}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
