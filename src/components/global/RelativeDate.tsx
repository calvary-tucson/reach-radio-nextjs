'use client'

import { relativeDate } from '@/lib/utils/date'

export function RelativeDate({
  date,
  className,
}: {
  date: string | null | undefined
  className?: string
}) {
  if (!date) return null
  return <span className={className}>{relativeDate(date)}</span>
}
