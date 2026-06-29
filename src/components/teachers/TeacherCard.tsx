import { ViewTransition } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'

interface TeacherCardProps {
  teacher: TeacherSummary
  index?: number
  viewTransitionDisabled?: boolean
  scheduleDays?: string
  onNavigate?: () => void
}

export function TeacherCard({
  teacher,
  index = 0,
  viewTransitionDisabled = false,
  scheduleDays,
  onNavigate,
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

  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      aria-label={teacher.title ? `${teacher.name} — ${teacher.title}` : teacher.name}
      transitionTypes={['nav-forward']}
      onNavigate={onNavigate}
      className="teacher-card block rounded-[18px] overflow-hidden bg-[#1c2128] light:bg-white border border-white/5 light:border-gray-200 motion-safe:hover:scale-[1.03] motion-safe:transition-all duration-200 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      style={{ '--stagger-i': index } as React.CSSProperties}
    >
      {teacher.photo && !viewTransitionDisabled ? (
        <ViewTransition name={`teacher-${teacher.slug}`}>{avatarEl}</ViewTransition>
      ) : avatarEl}
      <div className="px-[11px] md:px-3 pt-[9px] md:pt-3 pb-[11px] md:pb-3">
        <p className="text-white light:text-gray-900 font-bold text-[13px] md:text-sm leading-snug" aria-hidden="true">
          {teacher.name}
        </p>
        {teacher.title && (
          <p className="text-white/80 light:text-gray-600 text-[11px] md:text-xs mt-[3px]" aria-hidden="true">
            {teacher.title}
          </p>
        )}
        {scheduleDays && (
          <div className="flex items-center gap-[3px] mt-[5px]">
            <CalendarDays className="h-[13px] w-[13px] md:h-[13px] md:w-[13px] text-[#a3d46a] shrink-0" aria-hidden="true" />
            <span className="text-[10px] md:text-[10px] text-[#a3d46a] font-medium leading-none uppercase tracking-wide">
              {scheduleDays}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
