'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchInput } from '@/components/global/SearchInput'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { ScheduleTabView } from '@/components/teachers/ScheduleTabView'
import { FilterSheet } from '@/components/teachers/FilterSheet'
import { filterTeachers } from '@/lib/teachers/filter'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import type { SortOption } from '@/lib/teachers/filter'
import type { TeacherSummary, TeacherWithSchedule, ScheduleDay } from '@/lib/sanity/types'

const DAY_ABBREV_TO_FULL: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}
const DAY_FULL_TO_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(DAY_ABBREV_TO_FULL).map(([k, v]) => [v, k])
)

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
  initialQuery?: string
  initialSort?: SortOption
  initialDays?: string[]
}

type Tab = 'teachers' | 'schedule'

export function TeachersClientView({
  teachers,
  scheduleTeachers,
  initialQuery = '',
  initialSort,
  initialDays = [],
}: TeachersClientViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('teachers')
  const [query, setQuery] = useState(initialQuery)
  const [activeSort, setActiveSort] = useState<SortOption | undefined>(initialSort)
  const [activeDays, setActiveDays] = useState<string[]>(
    initialDays.map((a) => DAY_ABBREV_TO_FULL[a]).filter(Boolean)
  )
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 200)
  const hasMounted = useRef(false)

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

  const filtered = useMemo(
    () =>
      filterTeachers(teachers, debouncedQuery, {
        sort: activeSort,
        days: activeDays,
        scheduleMap,
        hoursMap,
      }),
    [teachers, debouncedQuery, activeSort, activeDays, scheduleMap, hoursMap]
  )

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    const params = new URLSearchParams()
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim())
    if (activeSort) params.set('sort', activeSort)
    if (activeDays.length) {
      params.set('days', activeDays.map((d) => DAY_FULL_TO_ABBREV[d]).filter(Boolean).join(','))
    }
    router.replace(params.toString() ? `/teachers?${params}` : '/teachers', { scroll: false })
  }, [debouncedQuery, activeSort, activeDays, router])

  const activeFilterCount = (activeSort ? 1 : 0) + (activeDays.length > 0 ? 1 : 0)
  const isFiltered = debouncedQuery.trim().length > 0 || activeFilterCount > 0
  const countLabel = isFiltered
    ? `${filtered.length} of ${teachers.length} shown`
    : `${teachers.length} teachers`

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl font-bold">Teachers</h1>
        {activeTab === 'teachers' && (
          <span className="text-white/50 text-sm" aria-live="polite" aria-atomic="true">
            {countLabel}
          </span>
        )}
      </div>

      <div className="flex gap-1 mb-5 border-b border-white/10">
        {(['teachers', 'schedule'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-white border-[var(--color-brand-green)]'
                : 'text-white/50 border-transparent hover:text-white/80'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search teachers..."
              aria-label="Search teachers"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
              className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-gray-700 text-white/70 hover:bg-gray-600 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-brand-green)] text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {activeDays.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDays((prev) => prev.filter((d) => d !== day))}
                  className="flex items-center gap-1 bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)] text-xs px-3 py-1.5 rounded-full hover:bg-[var(--color-brand-green)]/30 transition-colors cursor-pointer"
                >
                  {day}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              {activeSort && (
                <button
                  type="button"
                  onClick={() => setActiveSort(undefined)}
                  className="flex items-center gap-1 bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)] text-xs px-3 py-1.5 rounded-full hover:bg-[var(--color-brand-green)]/30 transition-colors cursor-pointer"
                >
                  {activeSort === 'name-asc' ? 'A–Z' : activeSort === 'name-desc' ? 'Z–A' : activeSort === 'most-on-air' ? 'Most on air' : activeSort}
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((teacher, index) => (
                <TeacherCard key={teacher.slug} teacher={teacher} index={index} />
              ))}
            </div>
          ) : isFiltered ? (
            <div className="text-white/60 mt-4">
              <p>No teachers found.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setActiveSort(undefined)
                  setActiveDays([])
                }}
                className="mt-2 text-sm text-white/80 underline hover:text-white cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : null}

          <FilterSheet
            open={filterSheetOpen}
            onClose={() => setFilterSheetOpen(false)}
            onApply={({ sort, days }) => {
              setActiveSort(sort)
              setActiveDays(days)
            }}
            initialSort={activeSort}
            initialDays={activeDays}
          />
        </>
      )}

      {activeTab === 'schedule' && <ScheduleTabView scheduleTeachers={scheduleTeachers} />}
    </>
  )
}
