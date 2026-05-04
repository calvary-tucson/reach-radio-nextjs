import { ViewTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { TeacherSummary } from '@/lib/sanity/types'

export function TeacherCard({ teacher }: { teacher: TeacherSummary }) {
  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      transitionTypes={['nav-forward']}
      className="block bg-gray-700/30 rounded overflow-hidden hover:bg-gray-700/50 transition-colors"
    >
      {teacher.photo && (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <Image
            src={teacher.photo}
            alt={teacher.name}
            width={300}
            height={300}
            className="w-full aspect-square object-cover"
          />
        </ViewTransition>
      )}
      <div className="p-3">
        <p className="text-white font-semibold text-sm">{teacher.name}</p>
        <p className="text-white/60 text-xs mt-1">{teacher.title}</p>
      </div>
    </Link>
  )
}
