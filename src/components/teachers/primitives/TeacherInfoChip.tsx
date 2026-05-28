import type { ReactNode } from 'react'

interface TeacherInfoChipProps {
  icon?: ReactNode
  label: string
  /** accent = green tint + green text. dim = white/5 bg + white/50 text. */
  variant: 'accent' | 'dim'
}

const VARIANT_CLASS = {
  accent: 'bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.2)] text-[#84b84f]',
  dim: 'bg-white/5 border border-white/10 text-white/50',
}

export function TeacherInfoChip({ icon, label, variant }: TeacherInfoChipProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${VARIANT_CLASS[variant]}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  )
}
