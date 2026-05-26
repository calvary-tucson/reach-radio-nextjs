import { sanityFetch } from '@/lib/sanity/client'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import type { TeacherSummary } from '@/lib/sanity/types'
import Image from 'next/image'
import Link from 'next/link'

export async function FeaturedTeachers() {
  const raw = await sanityFetch<TeacherSummary[]>(
    highlightedTeachersQuery,
    { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
    { tags: ['teachers'] }
  )

  const teachers = sortByHighlightedOrder(raw, HIGHLIGHTED_TEACHER_SLUGS)

  if (teachers.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between px-3 mb-3">
        <h2 className="text-white font-bold text-lg uppercase">Our Teachers</h2>
        <Link
          href="/teachers"
          className="text-white/60 text-sm hover:text-white transition-colors cursor-pointer"
        >
          See all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {teachers.map((teacher) => (
          <Link
            key={teacher.slug}
            href={`/teachers/${teacher.slug}`}
            className="flex-shrink-0 w-[120px] flex flex-col items-center gap-2 cursor-pointer"
          >
            <div className="relative w-[120px] h-[120px] rounded-lg overflow-hidden bg-gray-700">
              {teacher.photo && (
                <Image
                  src={teacher.photo}
                  alt={teacher.name}
                  fill
                  className="object-cover"
                  placeholder={teacher.lqip ? 'blur' : 'empty'}
                  blurDataURL={teacher.lqip ?? undefined}
                  sizes="120px"
                />
              )}
            </div>
            <div className="text-center">
              <p className="text-white text-sm font-medium leading-tight line-clamp-2">
                {teacher.name}
              </p>
              {teacher.title && (
                <p className="text-white/60 text-xs leading-tight line-clamp-1">{teacher.title}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
