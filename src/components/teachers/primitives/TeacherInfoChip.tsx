import type { ReactNode } from 'react'

interface TeacherInfoChipProps {
  icon?: ReactNode
  label: string
  /** accent = green tint + green text. dim = white/5 bg + white/50 text. */
  variant: 'accent' | 'dim'
}

const VARIANT_CLASS = {
  accent: 'bg-[rgba(132,184,79,0.1)] light:bg-green-100 border border-[rgba(132,184,79,0.2)] light:border-green-300 text-[#84b84f] light:text-green-700',
  dim: 'bg-white/5 light:bg-gray-100 border border-white/10 light:border-gray-200 text-white/50 light:text-gray-500',
}

export function TeacherInfoChip({ icon, label, variant }: TeacherInfoChipProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${VARIANT_CLASS[variant]}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  )
}
