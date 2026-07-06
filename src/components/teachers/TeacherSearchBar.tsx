'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

export function TeacherSearchBar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [displayValue, setDisplayValue] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    setDisplayValue(searchParams.get('q') ?? '')
  }, [searchParams])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  function pushQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) {
      params.set('q', value.trim())
    } else {
      params.delete('q')
    }
    const search = params.toString()
    router.replace(search ? `${pathname}?${search}` : pathname)
  }

  function handleChange(value: string) {
    setDisplayValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => pushQuery(value), 300)
  }

  function clear() {
    setDisplayValue('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    pushQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-[10px]">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 light:text-gray-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          data-search-input
          type="search"
          placeholder="Search teachers..."
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') clear() }}
          // Plain web keeps the full a11y ring (focus-visible:ring-ring),
          // per AGENTS.md. Inside the native-wrapped app, globals.css
          // overrides this to a platform-native border/background shift
          // instead of a glowing web ring (approved a11y one-off, 2026-07-06)
          // -- see the "Native search-field focus" block in globals.css.
          className="w-full bg-white/5 light:bg-white border border-white/10 light:border-gray-300 rounded-xl pl-10 pr-12 py-2.5 text-base text-white light:text-gray-900 placeholder:text-white/40 light:placeholder:text-gray-400 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Search teachers"
        />
        {displayValue && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={clear}
              className="flex h-11 w-11 items-center justify-center rounded text-white/60 light:text-gray-400 hover:text-white light:hover:text-gray-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
