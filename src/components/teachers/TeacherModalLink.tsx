'use client'

import { useRouter } from 'next/navigation'
import { useModalStore } from '@/lib/stores/modal'

interface TeacherModalLinkProps {
  slug: string
  name: string
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
  children: React.ReactNode
}

export function TeacherModalLink({
  slug,
  name,
  className,
  style,
  'aria-label': ariaLabel,
  children,
}: TeacherModalLinkProps) {
  const router = useRouter()
  const openModal = useModalStore((s) => s.openModal)

  return (
    <button
      type="button"
      onClick={() => {
        openModal(name)
        router.push(`/teachers/${slug}`)
      }}
      className={className}
      style={style}
      aria-label={ariaLabel ?? name}
    >
      {children}
    </button>
  )
}
