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
          className="rounded-lg border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-2 text-sm text-white/80 light:text-gray-700 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100"
        >
          Previous
        </Link>
      )}
      {pages.map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`e${i}`} className="px-2 text-white/60 light:text-gray-400">...</span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-sm motion-safe:transition-colors',
              item === currentPage
                ? 'bg-blue-600 font-bold text-white'
                : 'border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 text-white/70 light:text-gray-700 hover:bg-white/10 light:hover:bg-gray-100',
            )}
          >
            {item}
          </Link>
        ),
      )}
      {currentPage < totalPages && (
        <Link
          href={href(currentPage + 1)}
          className="rounded-lg border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-2 text-sm text-white/80 light:text-gray-700 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100"
        >
          Next
        </Link>
      )}
    </nav>
  )
}
