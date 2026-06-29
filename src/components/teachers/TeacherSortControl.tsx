'use client'

import { useTransition } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'
import { SORT_OPTIONS, VALID_SORTS } from '@/lib/teachers/filter'
import type { SortOption } from '@/lib/teachers/filter'

export function TeacherSortControl() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const urlSort = searchParams.get('sort') ?? ''
  const urlQ = searchParams.get('q') ?? ''
  const urlDays = searchParams.get('days')?.split(',').filter(Boolean) ?? []
  const sort: SortOption | undefined = VALID_SORTS.has(urlSort) ? (urlSort as SortOption) : undefined

  const hasFilter = urlQ.trim().length > 0 || !!sort || urlDays.length > 0

  function clearAll() {
    startTransition(() => router.replace(pathname))
  }

  function cycleSort() {
    const params = new URLSearchParams(searchParams.toString())
    if (!sort) {
      params.set('sort', 'name-asc')
    } else {
      const idx = SORT_OPTIONS.findIndex((o) => o.value === sort)
      const next = SORT_OPTIONS[idx + 1]
      if (next) {
        params.set('sort', next.value)
      } else {
        params.delete('sort')
      }
    }
    const search = params.toString()
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname))
  }

  const sortLabel = sort ? (SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort') : 'Sort'

  const baseClass =
    'shrink-0 flex items-center min-h-[44px] px-3 text-xs font-medium rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors'

  if (hasFilter) {
    return (
      <button
        type="button"
        onClick={clearAll}
        className={`${baseClass} text-white/70 light:text-gray-400 can-hover:hover:text-white light:can-hover:hover:text-gray-900`}
        aria-label="Clear all filters"
      >
        Clear all
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={cycleSort}
      className={`${baseClass} gap-1.5 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 text-white/70 light:text-gray-500 can-hover:hover:border-white/20 can-hover:hover:text-white/80 light:can-hover:hover:border-gray-300`}
      aria-label={sort ? `Sort: ${sortLabel}. Press to change.` : 'Sort'}
    >
      {!sort && <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />}
      {sortLabel}
    </button>
  )
}
