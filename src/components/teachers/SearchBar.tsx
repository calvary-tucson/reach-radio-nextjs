'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = (new FormData(e.currentTarget).get('q') as string).trim().slice(0, 100)
    startTransition(() => {
      router.push(`/teachers/search?q=${encodeURIComponent(q)}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex gap-2 mb-6">
      <label htmlFor="teacher-search" className="sr-only">Search teachers</label>
      <input
        id="teacher-search"
        name="q"
        type="search"
        defaultValue={searchParams.get('q') ?? ''}
        placeholder="Search teachers..."
        maxLength={100}
        className="flex-1 min-h-[44px] bg-gray-700/50 text-white placeholder:text-white/40 rounded px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white"
      />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="bg-[var(--color-brand-green)] text-white px-4 py-2 min-h-[44px] rounded text-sm font-medium disabled:opacity-50"
      >
        {isPending ? 'Searching...' : 'Search'}
      </button>
    </form>
  )
}
