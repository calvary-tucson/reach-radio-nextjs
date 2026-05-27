'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, ChevronRight } from 'lucide-react'
import { filterTeachers } from '@/lib/teachers/filter'
import { computeWeeklyMinutes } from '@/lib/utils/time'
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

function TeacherInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const initials =
    parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0]?.[0] ?? '?')
  return (
    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-green-900/60 to-gray-700/60 flex items-center justify-center shrink-0">
      <span className="text-white/80 text-sm font-bold uppercase">{initials}</span>
    </div>
  )
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

  useEffect(() => { inputRef.current?.focus() }, [])

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

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search teachers..."
          value={displayValue}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') clearQuery()
          }}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label="Search teachers"
        />
        {displayValue && (
          <button
            type="button"
            onClick={() => { clearQuery(); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center text-white/40 hover:text-white cursor-pointer"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={activeDays.includes(day)}
            onClick={() => toggleDay(day)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              activeDays.includes(day)
                ? 'bg-[var(--color-brand-green)] text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>

      <div className="flex items-center flex-wrap gap-2">
        <span className="text-white/70 text-xs">Sort:</span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={sort === option.value}
            onClick={() => setSort(sort === option.value ? undefined : option.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              sort === option.value
                ? 'bg-[var(--color-brand-green)] text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
        {hasFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-xs text-white/70 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            Clear all
          </button>
        )}
      </div>

      <p className="text-white/70 text-sm" aria-live="polite" aria-atomic="true">
        {results.length} {results.length === 1 ? 'teacher' : 'teachers'} found
      </p>

      {results.length > 0 ? (
        <ul className="space-y-1">
          {results.map((teacher) => (
            <li key={teacher.slug}>
              <Link
                href={`/teachers/${teacher.slug}`}
                className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                {teacher.photo ? (
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-gray-700 shrink-0">
                    <Image
                      src={teacher.photo}
                      alt={teacher.name}
                      fill
                      className="object-cover"
                      placeholder={teacher.lqip ? 'blur' : 'empty'}
                      blurDataURL={teacher.lqip}
                      sizes="44px"
                    />
                  </div>
                ) : (
                  <TeacherInitials name={teacher.name} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{teacher.name}</p>
                  {teacher.title && (
                    <p className="text-white/70 text-xs truncate">{teacher.title}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-white/20 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-white/40 text-center py-8">
          No teachers found. Try a different search.
        </p>
      )}
    </div>
  )
}
