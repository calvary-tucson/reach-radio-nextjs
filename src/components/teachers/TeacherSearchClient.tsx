'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { X, ChevronRight } from 'lucide-react'
import { filterTeachers } from '@/lib/teachers/filter'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'
import type { SortOption } from '@/lib/teachers/filter'
import type { TeacherSummary, TeacherWithSchedule, ScheduleDay } from '@/lib/sanity/types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'A–Z' },
  { value: 'name-desc', label: 'Z–A' },
  { value: 'most-on-air', label: 'Most on air' },
]

interface TeacherSearchClientProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
  initialQuery?: string
}

export function TeacherSearchClient({
  teachers,
  scheduleTeachers,
  initialQuery = '',
}: TeacherSearchClientProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [displayValue, setDisplayValue] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState<SortOption | undefined>(undefined)
  const [activeDays, setActiveDays] = useState<string[]>([])

  useEffect(() => {
    inputRef.current?.focus()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

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
    () => filterTeachers(teachers, query, { sort, days: activeDays, scheduleMap, hoursMap }),
    [teachers, query, sort, activeDays, scheduleMap, hoursMap]
  )

  const hasFilter = displayValue.trim().length > 0 || !!sort || activeDays.length > 0

  function handleQueryChange(value: string) {
    setDisplayValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setQuery(value), 300)
  }

  function clearQuery() {
    setDisplayValue('')
    setQuery('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  function toggleDay(day: string) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function clearAll() {
    clearQuery()
    setSort(undefined)
    setActiveDays([])
  }

  const chipBase = 'flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer border'
  const chipActive = 'bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]'
  const chipInactive = 'bg-[#1e2328] border-white/7 text-white/45 hover:bg-[#262d34] hover:text-white/65'

  return (
    <div>
      {/* Header: back + inline search */}
      <div className="flex items-center gap-[10px] px-4 pt-[14px] pb-[10px]">
        <Link
          href="/teachers"
          className="text-[#84b84f] text-[17px] leading-none cursor-pointer flex-shrink-0"
          aria-label="Back to teachers"
        >
          ‹
        </Link>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search teachers..."
            value={displayValue}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') clearQuery() }}
            className="w-full bg-[#1e2328] border border-white/7 rounded-[12px] pl-3 pr-9 py-2 text-white text-[13px] placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="Search teachers"
          />
          {displayValue && (
            <button
              type="button"
              onClick={() => { clearQuery(); inputRef.current?.focus() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-white/35 hover:text-white cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Day filter chips */}
      <div className="flex flex-wrap gap-[5px] px-4 pb-2">
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

      {/* Sort chips */}
      <div className="flex items-center flex-wrap gap-[5px] px-4 pb-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.07em] text-white/35 mr-1">
          Sort
        </span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={sort === option.value}
            onClick={() => setSort(sort === option.value ? undefined : option.value)}
            className={`${chipBase} ${sort === option.value ? chipActive : chipInactive}`}
          >
            {option.label}
          </button>
        ))}
        {hasFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-[10px] text-white/45 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            Clear all
          </button>
        )}
      </div>

      <p className="text-[10px] text-white/35 px-4 pb-2" aria-live="polite" aria-atomic="true">
        {results.length} {results.length === 1 ? 'teacher' : 'teachers'} found
      </p>

      {results.length > 0 ? (
        <ul>
          {results.map((teacher) => {
            const hrs = hoursMap.get(teacher.slug)
            const hoursPerWeek = hrs ? Math.round(hrs / 60) : 0
            return (
              <li key={teacher.slug}>
                <Link
                  href={`/teachers/${teacher.slug}`}
                  className="flex items-center gap-[10px] px-4 py-2 border-b border-white/4 hover:bg-white/4 transition-colors cursor-pointer"
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
                    <p className="text-white text-[13px] font-semibold truncate">{teacher.name}</p>
                    {teacher.title && (
                      <p className="text-white/45 text-[10px] truncate">{teacher.title}</p>
                    )}
                  </div>
                  {hoursPerWeek > 0 && (
                    <TeacherInfoChip label={`${hoursPerWeek}h`} variant="accent" />
                  )}
                  <ChevronRight className="h-4 w-4 text-white/18 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-white/35 text-center py-8 text-[13px]">
          No teachers found. Try a different search.
        </p>
      )}
    </div>
  )
}
