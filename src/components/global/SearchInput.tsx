'use client'

import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  'aria-label'?: string
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search…',
  className,
  autoFocus,
  'aria-label': ariaLabel,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn('relative', className)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 light:text-gray-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="w-full rounded-lg border border-white/20 light:border-gray-300 bg-white/5 light:bg-white pl-10 pr-10 py-2 text-base text-white light:text-gray-900 placeholder:text-white/60 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); onClear?.() }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded border border-white/20 light:border-gray-300 bg-white/5 light:bg-gray-50 text-white/60 light:text-gray-400 hover:text-white/80 light:hover:text-gray-700 hover:border-white/40 light:hover:border-gray-400 cursor-pointer"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
