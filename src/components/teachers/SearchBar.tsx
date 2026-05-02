'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q') as string
    startTransition(() => {
      router.push(`/teachers/search?q=${encodeURIComponent(q.trim())}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <input
        name="q"
        type="search"
        defaultValue={searchParams.get('q') ?? ''}
        placeholder="Search teachers..."
        className="flex-1 bg-gray-700/50 text-white placeholder:text-white/40 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
      />
      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-brand-green)] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
      >
        {isPending ? '...' : 'Search'}
      </button>
    </form>
  )
}
