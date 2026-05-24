interface ArrowLeftIconProps {
  className?: string
}

export function ArrowLeftIcon({ className }: ArrowLeftIconProps) {
  return (
    <svg
      viewBox="0 -960 960 960"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z" />
    </svg>
  )
}
