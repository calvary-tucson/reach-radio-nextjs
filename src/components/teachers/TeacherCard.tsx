import { ViewTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { TeacherSummary } from '@/lib/sanity/types'

function TeacherInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0]?.[0] ?? '?'
  return (
    <div className="w-full aspect-square bg-gray-600/50 flex items-center justify-center">
      <span className="text-white/80 text-3xl font-bold uppercase">{initials}</span>
    </div>
  )
}

export function TeacherCard({ teacher }: { teacher: TeacherSummary }) {
  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      transitionTypes={['nav-forward']}
      className="block rounded overflow-hidden border border-green-700 [box-shadow:0_0_28px_-10px_#517987] motion-safe:hover:scale-105 transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {teacher.photo ? (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <Image
            src={teacher.photo}
            alt={teacher.name}
            width={300}
            height={300}
            className="w-full aspect-square object-cover"
            placeholder={teacher.lqip ? 'blur' : 'empty'}
            blurDataURL={teacher.lqip}
          />
        </ViewTransition>
      ) : (
        <TeacherInitials name={teacher.name} />
      )}
      <div className="p-3">
        <p className="text-white font-semibold text-sm">{teacher.name}</p>
        <p className="text-white/80 text-xs mt-1">{teacher.title}</p>
      </div>
    </Link>
  )
}
