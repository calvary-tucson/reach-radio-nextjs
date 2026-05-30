import { ViewTransition } from 'react'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'
import { TeacherModalLink } from '@/components/teachers/TeacherModalLink'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { DAYS_ORDER } from '@/lib/teachers/schedule'
import { cn } from '@/lib/utils'
import type { TeacherDetail, TeacherSummary } from '@/lib/sanity/types'

interface Props {
  teacher: TeacherDetail
  relatedTeachers?: TeacherSummary[]
  headingLevel?: 'h1' | 'h2'
  isOverlay?: boolean
}

export function TeacherDetailContent({ teacher, relatedTeachers = [], headingLevel = 'h1', isOverlay = false }: Props) {
  const Heading = headingLevel

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  const weeklyMinutes = computeWeeklyMinutes(teacher.schedule ?? [])
  const hoursPerWeek = weeklyMinutes > 0 ? Math.round(weeklyMinutes / 60) : 0
  const daysOnAir = (teacher.schedule ?? []).length

  const primaryLink = teacher.links?.[0]
  const otherLinks = teacher.links?.slice(1) ?? []

  return (
    <div className="text-white light:text-gray-900">
      {/* Banner */}
      <div className="relative w-full h-[100px] md:h-[180px] mt-3 bg-gradient-to-br from-[#1e3a0a] to-[#0a1305] overflow-hidden">
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

      {/* Two-column layout at md (suppressed in overlay) */}
      <div className={cn(!isOverlay && "md:flex md:gap-8 md:px-8 md:items-start")}>

        {/* LEFT SIDEBAR */}
        <div className={cn(!isOverlay && "md:w-72 md:flex-shrink-0")}>
          {/* Avatar overlap row */}
          <div className={cn("flex items-end justify-between px-4 mt-[-88px] mb-3", !isOverlay && "md:px-0")}>
            <ViewTransition name={`teacher-${teacher.slug}`}>
              <TeacherAvatar
                name={teacher.name}
                photo={teacher.photo}
                lqip={teacher.lqip}
                size="3xl"
                shape="circle"
                ring
                sizes="176px"
              />
            </ViewTransition>
            {primaryLink && (
              <a
                href={primaryLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("bg-[#84b84f] rounded-full px-4 py-2 text-sm font-bold text-[#0a1305] cursor-pointer hover:bg-[#96cc5e] transition-colors", !isOverlay && "md:hidden")}
              >
                {`${primaryLink.title} ↗`}
              </a>
            )}
          </div>

          {/* Name + title */}
          <div className={cn("px-4 mb-[10px]", !isOverlay && "md:px-0")}>
            <Heading className="text-[26px] md:text-3xl font-extrabold tracking-tight">{teacher.name}</Heading>
            {(teacher.title || teacher.subtitle) && (
              <p className="text-base text-white/85 light:text-gray-700 mt-[3px] font-medium">
                {teacher.title}{teacher.subtitle ? ` · ${teacher.subtitle}` : ''}
              </p>
            )}
          </div>

          {/* Info chips */}
          {(hoursPerWeek > 0 || daysOnAir > 0) && (
            <div className={cn("flex flex-wrap gap-[7px] px-4 mb-3", !isOverlay && "md:px-0")}>
              {hoursPerWeek > 0 && (
                <TeacherInfoChip icon="📻" label={`${hoursPerWeek} hrs/wk`} variant="accent" />
              )}
              {daysOnAir > 0 && (
                <TeacherInfoChip label={`${daysOnAir} day${daysOnAir !== 1 ? 's' : ''}`} variant="accent" />
              )}
            </div>
          )}

          {/* Primary link — desktop only, not shown in overlay (avatar row already shows it) */}
          {primaryLink && !isOverlay && (
            <div className="hidden md:block px-0 mb-3">
              <a
                href={primaryLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-[#84b84f] rounded-full px-5 py-2 text-sm font-bold text-[#0a1305] cursor-pointer hover:bg-[#96cc5e] transition-colors"
              >
                {`${primaryLink.title} ↗`}
              </a>
            </div>
          )}

          {/* Other external links */}
          {otherLinks.length > 0 && (
            <div className={cn("flex flex-wrap gap-2 px-4 mb-4", !isOverlay && "md:px-0")}>
              {otherLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 light:bg-gray-100 border border-white/20 light:border-gray-300 rounded-full px-4 py-2 text-sm font-semibold text-white/80 light:text-gray-700 hover:bg-white/15 light:hover:bg-gray-200 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer"
                >
                  {link.title}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT MAIN */}
        <div className={cn(!isOverlay && "md:flex-1 md:min-w-0 md:pt-4")}>
          {sortedSchedule.length > 0 && (
            <>
              <div className={cn("h-px bg-white/6 light:bg-gray-200 mx-4 mb-3", !isOverlay && "md:hidden")} />
              <div className={cn("px-4 mb-4", !isOverlay && "md:px-0")}>
                <p className="text-sm font-bold uppercase tracking-[0.1em] text-white/80 light:text-gray-600 mb-[10px]">
                  On Air This Week
                </p>
                <div className="space-y-[8px] md:space-y-3">
                  {sortedSchedule.map((day) => (
                    <div key={day.day}>
                      <p className="text-base font-bold text-white/90 light:text-gray-900 mb-[5px]">{day.day}</p>
                      {day.times.map((t) => (
                        <div
                          key={`${t.startTime}-${t.endTime}`}
                          className="border-l-[3px] border-[#84b84f] bg-[rgba(132,184,79,0.08)] light:bg-green-50 rounded-r-[8px] py-1.5 px-2.5 text-base md:text-sm text-white/90 light:text-gray-900 mb-[3px]"
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
      </div>

      {/* Also on Reach Radio */}
      {relatedTeachers.length > 0 && (
        <>
          <div className={cn("h-px bg-white/6 light:bg-gray-200 mx-4 mb-3", !isOverlay && "md:mx-8")} />
          <div className={cn("pb-6", !isOverlay && "md:pb-10")}>
            <p className={cn("text-sm font-bold uppercase tracking-[0.1em] text-white/80 light:text-gray-600 px-4 mb-3", !isOverlay && "md:px-8")}>
              Also on Reach Radio
            </p>
            <div className={cn("flex gap-[10px] overflow-x-auto px-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", !isOverlay && "md:gap-4 md:px-8")}>
              {relatedTeachers.map((t) => (
                <TeacherModalLink
                  key={t.slug}
                  slug={t.slug}
                  name={t.name}
                  className="flex flex-col items-center gap-[4px] md:gap-2 flex-shrink-0 w-[72px] md:w-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded cursor-pointer"
                >
                  <TeacherAvatar
                    name={t.name}
                    photo={t.photo}
                    lqip={t.lqip}
                    size="md"
                    shape="circle"
                    sizes="48px"
                  />
                  <span className="text-sm text-white/80 light:text-gray-700 text-center line-clamp-2 leading-tight">
                    {t.name}
                  </span>
                </TeacherModalLink>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
