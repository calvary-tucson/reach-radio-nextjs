'use client'

import { useState } from 'react'
import { BottomSheet } from '@/components/global/BottomSheet'
import type { SortOption } from '@/lib/teachers/filter'

interface ApplyPayload {
  sort: SortOption | undefined
  days: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  onApply: (payload: ApplyPayload) => void
  initialSort: SortOption | undefined
  initialDays: string[]
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'A – Z' },
  { value: 'name-desc', label: 'Z – A' },
  { value: 'most-on-air', label: 'Most on air' },
]

const DAY_OPTIONS: { label: string; full: string }[] = [
  { label: 'Sun', full: 'Sunday' },
  { label: 'Mon', full: 'Monday' },
  { label: 'Tue', full: 'Tuesday' },
  { label: 'Wed', full: 'Wednesday' },
  { label: 'Thu', full: 'Thursday' },
  { label: 'Fri', full: 'Friday' },
  { label: 'Sat', full: 'Saturday' },
]

export function FilterSheet({ open, onClose, onApply, initialSort, initialDays }: Props) {
  const [pendingSort, setPendingSort] = useState<SortOption | undefined>(initialSort)
  const [pendingDays, setPendingDays] = useState<string[]>(initialDays)

  function toggleDay(fullName: string) {
    setPendingDays((prev) =>
      prev.includes(fullName) ? prev.filter((d) => d !== fullName) : [...prev, fullName]
    )
  }

  function handleApply() {
    onApply({ sort: pendingSort, days: pendingDays })
    onClose()
  }

  function handleClear() {
    setPendingSort(undefined)
    setPendingDays([])
    onApply({ sort: undefined, days: [] })
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Filter and sort teachers">
      <div className="flex items-center justify-between px-6 pb-4">
        <h2 className="text-white text-xl font-bold">Filter &amp; Sort</h2>
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

      <div className="px-6 pb-10 space-y-6">
        <div>
          <p className="text-white/50 text-xs uppercase font-semibold mb-3">Sort by</p>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPendingSort(pendingSort === value ? undefined : value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                  pendingSort === value
                    ? 'bg-[var(--color-brand-green)] text-white'
                    : 'bg-gray-700 text-white/70 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-white/50 text-xs uppercase font-semibold mb-3">Airs on</p>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map(({ label, full }) => (
              <button
                key={full}
                type="button"
                onClick={() => toggleDay(full)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                  pendingDays.includes(full)
                    ? 'bg-[var(--color-brand-green)] text-white'
                    : 'bg-gray-700 text-white/70 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 bg-[var(--color-brand-green)] text-white py-4 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 cursor-pointer"
            aria-label="Apply filters"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-4 rounded-xl text-white/60 text-sm font-medium hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
