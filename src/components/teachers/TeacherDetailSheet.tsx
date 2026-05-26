'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BottomSheet } from '@/components/global/BottomSheet'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

interface Props {
  teacher: TeacherWithSchedule | null
  open: boolean
  onClose: () => void
}

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function TeacherDetailSheet({ teacher, open, onClose }: Props) {
  if (!teacher) return null

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`${teacher.name} details`}>
      <div className="flex items-center justify-between px-6 pb-4">
        <h2 className="text-white text-xl font-bold">{teacher.name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-6 pb-10 space-y-5 overflow-y-auto max-h-[60vh]">
        <div className="flex items-center gap-4">
          {teacher.photo ? (
            <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={teacher.photo}
                alt={teacher.name}
                fill
                className="object-cover"
                placeholder={teacher.lqip ? 'blur' : 'empty'}
                blurDataURL={teacher.lqip ?? undefined}
                sizes="80px"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-700 flex-shrink-0" />
          )}
          <div>
            <p className="text-white/70 text-sm">{teacher.title}</p>
          </div>
        </div>

        {sortedSchedule.length > 0 && (
          <div>
            <h3 className="text-white/50 text-xs uppercase font-semibold mb-2">This Week</h3>
            <ul className="space-y-1.5">
              {sortedSchedule.map((day) => (
                <li key={day.day} className="flex gap-3">
                  <span className="text-white text-sm font-medium w-24 shrink-0">{day.day}</span>
                  <span className="text-white/60 text-sm">
                    {day.times.map((t) => `${t.startTime} – ${t.endTime}`).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href={`/teachers/${teacher.slug}`}
          onClick={onClose}
          className="flex items-center justify-center w-full bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-4 text-sm font-semibold transition-colors cursor-pointer"
          aria-label={`View full profile for ${teacher.name}`}
        >
          View full profile →
        </Link>
      </div>
    </BottomSheet>
  )
}
