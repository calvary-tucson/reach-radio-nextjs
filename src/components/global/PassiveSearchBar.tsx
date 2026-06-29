import { ModalLink } from '@/components/modals/ModalLink'
import { cn } from '@/lib/utils'

interface PassiveSearchBarProps {
  href: string
  placeholder?: string
  ariaLabel?: string
  modalTitle?: string
  className?: string
}

export function PassiveSearchBar({
  href,
  placeholder = 'Search...',
  ariaLabel,
  modalTitle,
  className,
}: PassiveSearchBarProps) {
  return (
    <ModalLink
      href={href}
      modalTitle={modalTitle ?? placeholder}
      aria-label={ariaLabel ?? placeholder}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-3 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
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
        className="text-white/40 light:text-gray-500 shrink-0"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <span className="text-white/40 light:text-gray-500">{placeholder}</span>
    </ModalLink>
  )
}
