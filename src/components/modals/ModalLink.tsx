'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useModalStore } from '@/lib/stores/modal'
import { useNavigationStore } from '@/lib/stores/navigation-store'

interface ModalLinkProps extends ComponentProps<typeof Link> {
  /** Title shown in the modal skeleton while the route loads */
  modalTitle?: string
}

export function ModalLink({ children, modalTitle, ...props }: ModalLinkProps) {
  const openModal = useModalStore((s) => s.openModal)
  const setTriggerRef = useModalStore((s) => s.setTriggerRef)
  const resetNav = useNavigationStore((s) => s.reset)

  return (
    <Link
      {...props}
      onNavigate={() => {
        setTriggerRef(document.activeElement instanceof HTMLElement ? document.activeElement : null)
        resetNav()
        openModal(modalTitle)
      }}
    >
      {children}
    </Link>
  )
}
