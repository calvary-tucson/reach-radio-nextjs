'use client'

import { useState, useMemo, useEffect, useRef, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X, Loader2, ChevronRight } from 'lucide-react'
import { filterTeachers } from '@/lib/teachers/filter'
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
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'A–Z' },
  { value: 'name-desc', label: 'Z–A' },
  { value: 'most-on-air', label: 'Most on air' },
]
const VALID_SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value))

interface TeacherSearchClientProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

export function TeacherSearchClient({
  teachers,
  scheduleTeachers,
}: TeacherSearchClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const urlQ = searchParams.get('q') ?? ''
  const urlDays = searchParams.get('days')?.split(',').filter(Boolean) ?? []
  const urlSort = searchParams.get('sort') ?? ''

  const [displayValue, setDisplayValue] = useState(urlQ)
  const [query, setQuery] = useState(urlQ)
  const [activeDays, setActiveDays] = useState<string[]>(urlDays)
  const [sort, setSort] = useState<SortOption | undefined>(
    VALID_SORTS.has(urlSort) ? (urlSort as SortOption) : undefined
  )

  useEffect(() => {
    inputRef.current?.focus()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
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

  function pushURL(nextQ: string, nextDays: string[], nextSort: SortOption | undefined) {
    const params = new URLSearchParams()
    if (nextQ.trim()) params.set('q', nextQ.trim())
    if (nextDays.length) params.set('days', nextDays.join(','))
    if (nextSort) params.set('sort', nextSort)
    const search = params.toString()
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    })
  }

  function handleQueryChange(value: string) {
    setDisplayValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQuery(value)
      pushURL(value, activeDays, sort)
    }, 300)
  }

  function clearQuery() {
    setDisplayValue('')
    setQuery('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    pushURL('', activeDays, sort)
  }

  function toggleDay(day: string) {
    const next = activeDays.includes(day)
      ? activeDays.filter((d) => d !== day)
      : [...activeDays, day]
    setActiveDays(next)
    pushURL(displayValue, next, sort)
  }

  function setAndPushSort(next: SortOption | undefined) {
    setSort(next)
    pushURL(displayValue, activeDays, next)
  }

  function clearAll() {
    setDisplayValue('')
    setQuery('')
    setSort(undefined)
    setActiveDays([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    startTransition(() => {
      router.replace(pathname, { scroll: false })
    })
  }

  const chipBase =
    'min-h-[44px] flex items-center shrink-0 rounded-full px-3 text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
  const chipActive =
    'bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]'
  const chipInactive =
    'bg-white/5 light:bg-gray-50 border-white/10 light:border-gray-200 text-white/60 light:text-gray-500 can-hover:hover:border-white/20 can-hover:hover:text-white/80 light:can-hover:hover:border-gray-300'
  const sectionLabel =
    'text-[10px] font-semibold text-white/60 light:text-gray-500 uppercase tracking-widest mb-1.5'

  return (
    <div className="max-w-screen-xl mx-auto space-y-4">

      {/* Search input */}
      <div className="flex items-center gap-[10px]">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 light:text-gray-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search teachers..."
            value={displayValue}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') clearQuery()
            }}
            className="w-full bg-white/5 light:bg-white border border-white/10 light:border-gray-300 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white light:text-gray-900 placeholder:text-white/40 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="Search teachers"
          />
          {displayValue && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isPending ? (
                <Loader2
                  className="h-4 w-4 text-white/40 light:text-gray-400 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    clearQuery()
                    inputRef.current?.focus()
                  }}
                  className="flex h-8 w-8 items-center justify-center text-white/40 light:text-gray-400 hover:text-white light:hover:text-gray-900 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Day filter */}
      <div>
        <p className={sectionLabel}>Day</p>
        <div className="relative">
          <div
            className="flex gap-2 overflow-x-auto pb-1 pr-12 md:pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      </div>

      {/* Sort filter */}
      <div>
        <p className={sectionLabel}>Sort</p>
        <div className="flex items-center flex-wrap gap-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sort === option.value}
              onClick={() =>
                setAndPushSort(sort === option.value ? undefined : option.value)
              }
              className={`${chipBase} ${sort === option.value ? chipActive : chipInactive}`}
            >
              {option.label}
            </button>
          ))}
          {hasFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto text-xs text-white/45 light:text-gray-400 can-hover:hover:text-white light:can-hover:hover:text-gray-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div>
        <p
          className="text-sm text-white/60 light:text-gray-500 mb-3"
          aria-live="polite"
          aria-atomic="true"
        >
          {results.length} {results.length === 1 ? 'teacher' : 'teachers'} found
        </p>

        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-xl bg-white/5 light:bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((teacher) => {
              return (
                <li key={teacher.slug}>
                  <TeacherModalLink
                    slug={teacher.slug}
                    name={teacher.name}
                    className="w-full rounded-xl border border-white/10 light:border-gray-200 bg-white/5 light:bg-gray-50 p-3 flex items-center gap-3 text-left transition-colors cursor-pointer can-hover:hover:bg-white/10 light:can-hover:hover:bg-gray-100 can-hover:hover:border-white/20 light:can-hover:hover:border-gray-300"
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
                    <ChevronRight
                      className="h-4 w-4 text-white/18 shrink-0"
                      aria-hidden="true"
                    />
                  </TeacherModalLink>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-white/45 light:text-gray-400 py-12">
            No teachers found. Try a different search.
          </p>
        )}
      </div>
    </div>
  )
}
