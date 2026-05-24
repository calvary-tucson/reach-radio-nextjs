import { ViewTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { TeacherSummary } from '@/lib/sanity/types'

interface TeacherCardProps {
  teacher: TeacherSummary
  index?: number
}

function TeacherInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0]?.[0] ?? '?'
  return (
    <div className="w-full aspect-square bg-gradient-to-br from-green-900/60 to-gray-700/60 flex items-center justify-center">
      <span className="text-white/80 text-3xl font-bold uppercase">{initials}</span>
    </div>
  )
}

export function TeacherCard({ teacher, index = 0 }: TeacherCardProps) {
  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      aria-label={`${teacher.name} — ${teacher.title}`}
      transitionTypes={['nav-forward']}
      className="teacher-card block rounded overflow-hidden border border-white/10 hover:border-white/25 motion-safe:hover:scale-[1.03] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{ '--stagger-i': index } as React.CSSProperties}
    >
      {teacher.photo ? (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <div className="relative aspect-square">
            <Image
              src={teacher.photo}
              alt=""
              fill
              className="object-cover"
              placeholder={teacher.lqip ? 'blur' : 'empty'}
              blurDataURL={teacher.lqip}
              sizes="(max-width: 640px) 50vw, 25vw"
            />
          </div>
        </ViewTransition>
      ) : (
        <TeacherInitials name={teacher.name} />
      )}
      <div className="px-3 pt-3 pb-4">
        <p className="text-white font-semibold text-sm" aria-hidden="true">{teacher.name}</p>
        <p className="text-white/60 text-xs mt-1.5" aria-hidden="true">{teacher.title}</p>
      </div>
    </Link>
  )
}
