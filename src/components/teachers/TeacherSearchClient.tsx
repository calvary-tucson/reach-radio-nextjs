'use client'

import { useMemo, useTransition } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { filterTeachers, VALID_SORTS } from '@/lib/teachers/filter'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherModalLink } from '@/components/teachers/TeacherModalLink'
import type { SortOption } from '@/lib/teachers/filter'
import type { TeacherSummary, TeacherWithSchedule, ScheduleDay } from '@/lib/sanity/types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

interface TeacherSearchClientProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

export function TeacherSearchClient({
  teachers,
  scheduleTeachers,
}: TeacherSearchClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const urlQ = searchParams.get('q') ?? ''
  const urlDays = searchParams.get('days')?.split(',').filter(Boolean) ?? []
  const urlSort = searchParams.get('sort') ?? ''
  const activeDays = urlDays
  const sort: SortOption | undefined = VALID_SORTS.has(urlSort) ? (urlSort as SortOption) : undefined

  const scheduleMap = useMemo(
    () => new Map<string, ScheduleDay[]>(scheduleTeachers.map((t) => [t.slug, t.schedule])),
    [scheduleTeachers]
  )
  const hoursMap = useMemo(
    () =>
      new Map<string, number>(
        scheduleTeachers.map((t) => [t.slug, computeWeeklyMinutes(t.schedule)])
      ),
    [scheduleTeachers]
  )

  const results = useMemo(
    () => filterTeachers(teachers, urlQ, { sort, days: activeDays, scheduleMap, hoursMap }),
    [teachers, urlQ, sort, activeDays, scheduleMap, hoursMap]
  )

  function toggleDay(day: string) {
    const next = activeDays.includes(day)
      ? activeDays.filter((d) => d !== day)
      : [...activeDays, day]
    const params = new URLSearchParams()
    if (urlQ.trim()) params.set('q', urlQ.trim())
    if (next.length) params.set('days', next.join(','))
    if (sort) params.set('sort', sort)
    const search = params.toString()
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname))
  }

  const chipBase =
    'min-h-[44px] flex items-center shrink-0 rounded-full px-3 text-xs font-medium border motion-safe:transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
  const chipActive =
    'bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]'
  const chipInactive =
    'bg-white/5 light:bg-gray-50 border-white/10 light:border-gray-200 text-white/60 light:text-gray-500 can-hover:hover:border-white/20 can-hover:hover:text-white/80 light:can-hover:hover:border-gray-300'

  return (
    <div className="max-w-screen-xl mx-auto space-y-3">

      {/* Day filter — full-width scrollable row, no label */}
      <div className="relative">
        <div
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by day"
        >
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={activeDays.includes(day)}
              onClick={() => toggleDay(day)}
              className={`${chipBase} ${activeDays.includes(day) ? chipActive : chipInactive}`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[oklch(24%_0.05_280)] to-transparent md:hidden" />
      </div>

      {/* Results */}
      <div>
        <p
          className="text-sm text-white/60 light:text-gray-500 mb-3"
          aria-live="polite"
          aria-atomic="true"
        >
          {isPending ? 'Loading…' : `${results.length} ${results.length === 1 ? 'teacher' : 'teachers'} found`}
        </p>

        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-xl bg-white/5 light:bg-gray-50 motion-safe:animate-pulse" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((teacher) => (
              <li key={teacher.slug}>
                <TeacherModalLink
                  slug={teacher.slug}
                  name={teacher.name}
                  className="w-full rounded-xl border border-white/10 light:border-gray-200 bg-white/5 light:bg-gray-50 p-3 flex items-center gap-3 text-left motion-safe:transition-colors cursor-pointer can-hover:hover:bg-white/10 light:can-hover:hover:bg-gray-100 can-hover:hover:border-white/20 light:can-hover:hover:border-gray-300"
                >
                  <TeacherAvatar
                    name={teacher.name}
                    photo={teacher.photo}
                    lqip={teacher.lqip}
                    size="sm"
                    shape="rounded"
                    sizes="38px"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white light:text-gray-900 truncate">
                      {teacher.name}
                    </p>
                    {teacher.title && (
                      <p className="text-xs text-white/60 light:text-gray-500 truncate">{teacher.title}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/18 shrink-0" aria-hidden="true" />
                </TeacherModalLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/70 light:text-gray-400 py-12">
            No teachers found. Try a different search.
          </p>
        )}
      </div>
    </div>
  )
}
