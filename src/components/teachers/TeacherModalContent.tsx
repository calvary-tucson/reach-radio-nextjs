import Link from 'next/link'
import type { TeacherDetail } from '@/lib/sanity/types'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  teacher: TeacherDetail
}

export function TeacherModalContent({ teacher }: Props) {
  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  const weeklyMinutes = computeWeeklyMinutes(teacher.schedule ?? [])
  const hoursPerWeek = weeklyMinutes > 0 ? Math.round(weeklyMinutes / 60) : 0
  const daysOnAir = (teacher.schedule ?? []).length

  const primaryLink = teacher.links?.[0]
  const otherLinks = teacher.links?.slice(1) ?? []

  return (
    <div className="text-white">
      {/* Banner */}
      <div className="relative w-full h-[72px] bg-gradient-to-br from-[#1e3a0a] to-[#0a1305] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(60deg, rgba(132,184,79,0.04) 0px, rgba(132,184,79,0.04) 2px, transparent 2px, transparent 14px)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(132,184,79,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Avatar + primary link */}
      <div className="flex items-end justify-between px-4 mt-[-36px] mb-[10px]">
        <TeacherAvatar
          name={teacher.name}
          photo={teacher.photo}
          lqip={teacher.lqip}
          size="xl"
          shape="circle"
          ring
          sizes="80px"
        />
        {primaryLink && (
          <a
            href={primaryLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.3)] rounded-full px-3 py-[6px] text-[10px] font-semibold text-[#84b84f] cursor-pointer hover:bg-[rgba(132,184,79,0.18)] transition-colors"
          >
            {primaryLink.title} &#8599;
          </a>
        )}
      </div>

      {/* Name + title */}
      <div className="px-4 mb-[10px]">
        <h2 className="text-[19px] font-extrabold tracking-tight">{teacher.name}</h2>
        {(teacher.title || teacher.subtitle) && (
          <p className="text-[11px] text-white/50 mt-[3px] font-medium">
            {teacher.title}{teacher.subtitle ? ` · ${teacher.subtitle}` : ''}
          </p>
        )}
      </div>

      {/* Info chips */}
      {(hoursPerWeek > 0 || daysOnAir > 0) && (
        <div className="flex flex-wrap gap-[7px] px-4 mb-3">
          {hoursPerWeek > 0 && (
            <TeacherInfoChip icon="📻" label={`${hoursPerWeek} hrs/wk`} variant="accent" />
          )}
          {daysOnAir > 0 && (
            <TeacherInfoChip label={`${daysOnAir} day${daysOnAir !== 1 ? 's' : ''}`} variant="accent" />
          )}
        </div>
      )}

      {/* Other links */}
      {otherLinks.length > 0 && (
        <div className="flex flex-wrap gap-[6px] px-4 mb-4">
          {otherLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/6 border border-white/10 rounded-full px-3 py-[5px] text-[10px] font-semibold text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
            >
              {link.title}
            </a>
          ))}
        </div>
      )}

      {/* Schedule */}
      {sortedSchedule.length > 0 && (
        <>
          <div className="h-px bg-white/6 mx-4 mb-3" />
          <div className="px-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35 mb-[10px]">
              On Air This Week
            </p>
            <div className="space-y-[8px]">
              {sortedSchedule.map((day) => (
                <div key={day.day}>
                  <p className="text-[11px] font-bold text-white/60 mb-[5px]">{day.day}</p>
                  {day.times.map((t) => (
                    <div
                      key={`${t.startTime}-${t.endTime}`}
                      className="border-l-[3px] border-[#84b84f] bg-[rgba(132,184,79,0.08)] rounded-r-[8px] py-1.5 px-2.5 text-[10px] text-white/55 mb-[3px]"
                    >
                      {t.startTime} &ndash; {t.endTime}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
