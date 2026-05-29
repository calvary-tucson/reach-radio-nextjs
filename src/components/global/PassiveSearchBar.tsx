import { ModalLink } from '@/components/modals/ModalLink'
import { cn } from '@/lib/utils'

interface PassiveSearchBarProps {
  href: string
  placeholder?: string
  modalTitle?: string
  className?: string
}

export function PassiveSearchBar({
  href,
  placeholder = 'Search...',
  modalTitle,
  className,
}: PassiveSearchBarProps) {
  return (
    <ModalLink
      href={href}
      modalTitle={modalTitle ?? placeholder}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-3 transition-colors hover:bg-white/10 light:hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer',
        className
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/40 light:text-gray-400 shrink-0"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <span className="text-white/40 light:text-gray-400">{placeholder}</span>
    </ModalLink>
  )
}
