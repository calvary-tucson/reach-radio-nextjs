import Link from 'next/link'

import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  basePath: string
}

export default function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | 'ellipsis')[] = []
  const addPage = (n: number) => {
    if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n)
  }

  addPage(1)
  if (currentPage > 3) pages.push('ellipsis')
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    addPage(i)
  }
  if (currentPage < totalPages - 2) pages.push('ellipsis')
  addPage(totalPages)

  function href(page: number) {
    return page === 1 ? basePath : `${basePath}?page=${page}`
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 pt-10">
      {currentPage > 1 && (
        <Link
          href={href(currentPage - 1)}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
        >
          Previous
        </Link>
      )}
      {pages.map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`e${i}`} className="px-2 text-white/60">...</span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors',
              item === currentPage
                ? 'bg-blue-600 font-bold text-white'
                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
            )}
          >
            {item}
          </Link>
        ),
      )}
      {currentPage < totalPages && (
        <Link
          href={href(currentPage + 1)}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
        >
          Next
        </Link>
      )}
    </nav>
  )
}
