'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'

export function TeacherSearchBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [displayValue, setDisplayValue] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    setDisplayValue(searchParams.get('q') ?? '')
  }, [searchParams])

  function pushQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) {
      params.set('q', value.trim())
    } else {
      params.delete('q')
    }
    const search = params.toString()
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    })
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
          type="text"
          autoFocus
          placeholder="Search teachers..."
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') clear() }}
          className="w-full bg-white/5 light:bg-white border border-white/10 light:border-gray-300 rounded-xl pl-10 pr-12 py-2.5 text-base sm:text-sm text-white light:text-gray-900 placeholder:text-white/40 light:placeholder:text-gray-400 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          aria-label="Search teachers"
        />
        {displayValue && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isPending ? (
              <Loader2 className="h-4 w-4 text-white/40 light:text-gray-400 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <button
                type="button"
                onClick={clear}
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
  )
}
