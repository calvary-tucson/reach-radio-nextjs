import { ViewTransition } from 'react'
import Link from 'next/link'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'

interface TeacherCardProps {
  teacher: TeacherSummary
  index?: number
  viewTransitionDisabled?: boolean
  weeklyMinutes?: number
}

export function TeacherCard({
  teacher,
  index = 0,
  viewTransitionDisabled = false,
  weeklyMinutes,
}: TeacherCardProps) {
  const avatarEl = (
    <div className="relative aspect-square bg-gradient-to-br from-[#253520] to-[#131b0d]">
      <TeacherAvatar
        name={teacher.name}
        photo={teacher.photo}
        lqip={teacher.lqip}
        size="lg"
        fill
        shape="rounded"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
    </div>
  )

  const hoursPerWeek = weeklyMinutes ? Math.round(weeklyMinutes / 60) : 0

  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      aria-label={teacher.title ? `${teacher.name} — ${teacher.title}` : teacher.name}
      transitionTypes={['nav-forward']}
      className="teacher-card block rounded-[18px] overflow-hidden bg-[#1c2128] border border-white/5 motion-safe:hover:scale-[1.03] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
      style={{ '--stagger-i': index } as React.CSSProperties}
    >
      {teacher.photo && !viewTransitionDisabled ? (
        <ViewTransition name={`teacher-${teacher.slug}`}>{avatarEl}</ViewTransition>
      ) : avatarEl}
      <div className="px-[11px] pt-[9px] pb-[11px]">
        <p className="text-white font-bold text-[11px] leading-snug" aria-hidden="true">
          {teacher.name}
        </p>
        {teacher.title && (
          <p className="text-white/45 text-[9px] mt-[3px]" aria-hidden="true">
            {teacher.title}
          </p>
        )}
        {hoursPerWeek > 0 && (
          <div className="mt-[5px]">
            <TeacherInfoChip label={`${hoursPerWeek} hrs/wk`} variant="accent" />
          </div>
        )}
      </div>
    </Link>
  )
}
