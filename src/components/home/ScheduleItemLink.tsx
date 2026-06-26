'use client'

import Link from 'next/link'
import { useModalStore } from '@/lib/stores/modal'

interface ScheduleItemLinkProps {
  slug: string
  name: string
  idx: number
  children: React.ReactNode
}

export function ScheduleItemLink({ slug, name, idx, children }: ScheduleItemLinkProps) {
  const openModal = useModalStore((s) => s.openModal)

  return (
    <Link
      href={`/teachers/${slug}`}
      onClick={() => openModal(name)}
      className="schedule-row flex items-center justify-between flex-wrap bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl p-2 hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 motion-safe:transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      style={{ '--stagger-i': idx } as React.CSSProperties}
    >
      <div className="flex gap-5">{children}</div>
    </Link>
  )
}
