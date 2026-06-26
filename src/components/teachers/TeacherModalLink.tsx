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
      onPointerEnter={() => router.prefetch(`/teachers/${slug}`)}
      onPointerDown={() => router.prefetch(`/teachers/${slug}`)}
      onClick={() => {
        // If a modal is already open (e.g. search sheet), stack on top rather than reset
        const store = useModalStore.getState()
        if (store.isOpen) {
          store.pushModal(name)
        } else {
          openModal(name)
        }
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
