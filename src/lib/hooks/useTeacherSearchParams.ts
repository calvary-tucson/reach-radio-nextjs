'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { VALID_SORTS } from '@/lib/teachers/filter'
import type { SortOption } from '@/lib/teachers/filter'

export interface TeacherSearchParams {
  urlQ: string
  urlDays: string[]
  sort: SortOption | undefined
}

export function useTeacherSearchParams(): TeacherSearchParams {
  const searchParams = useSearchParams()

  const urlQ = searchParams.get('q') ?? ''
  const urlSort = searchParams.get('sort') ?? ''

  const urlDays = useMemo(
    () => searchParams.get('days')?.split(',').filter(Boolean) ?? [],
    [searchParams]
  )

  const sort: SortOption | undefined = VALID_SORTS.has(urlSort) ? (urlSort as SortOption) : undefined

  return { urlQ, urlDays, sort }
}
