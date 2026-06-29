import type { TeacherSummary, ScheduleDay } from '@/lib/sanity/types'

export type SortOption = 'name-asc' | 'name-desc' | 'most-on-air'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'A–Z' },
  { value: 'name-desc', label: 'Z–A' },
  { value: 'most-on-air', label: 'Most on air' },
]

export const VALID_SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value))

export interface FilterOptions {
  sort?: SortOption
  days?: string[]
  scheduleMap?: Map<string, ScheduleDay[]>
  hoursMap?: Map<string, number>
}

export function filterTeachers(
  teachers: TeacherSummary[],
  query: string,
  options: FilterOptions = {}
): TeacherSummary[] {
  const { sort, days = [], scheduleMap, hoursMap } = options

  const q = query.trim().toLowerCase()
  let result: TeacherSummary[] = q
    ? teachers.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.title?.toLowerCase().includes(q) ?? false)
      )
    : [...teachers]

  if (days.length > 0 && scheduleMap) {
    result = result.filter((t) => {
      const schedule = scheduleMap.get(t.slug) ?? []
      return schedule.some((s) => days.includes(s.day))
    })
  }

  if (sort === 'name-asc') {
    result.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'name-desc') {
    result.sort((a, b) => b.name.localeCompare(a.name))
  } else if (sort === 'most-on-air' && hoursMap) {
    result.sort((a, b) => (hoursMap.get(b.slug) ?? 0) - (hoursMap.get(a.slug) ?? 0))
  }

  return result
}
