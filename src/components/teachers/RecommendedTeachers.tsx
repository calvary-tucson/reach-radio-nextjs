import Link from 'next/link'
import { sanityFetch } from '@/lib/sanity/client'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'

export async function RecommendedTeachers() {
  const raw = await sanityFetch<TeacherSummary[]>(
    highlightedTeachersQuery,
    { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
    { tags: ['teachers'] }
  )

  const teachers = sortByHighlightedOrder(raw, HIGHLIGHTED_TEACHER_SLUGS)

  if (teachers.length === 0) return null

  return (
    <section className="mb-4 md:mb-6" aria-label="Recommended teachers">
      <p className="text-[11px] md:text-sm font-bold uppercase tracking-[0.08em] text-white/35 px-0 mb-[10px] md:mb-3">
        Recommended
      </p>
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {teachers.map((teacher, index) => (
          <Link
            key={teacher.slug}
            href={`/teachers/${teacher.slug}`}
            className="flex flex-col items-center gap-[5px] md:gap-2 flex-shrink-0 w-[72px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
            aria-label={teacher.name}
            style={{ '--stagger-i': index } as React.CSSProperties}
          >
            <div className="teacher-card">
              <TeacherAvatar
                name={teacher.name}
                photo={teacher.photo}
                lqip={teacher.lqip}
                size="lg"
                shape="circle"
                sizes="72px"
              />
            </div>
            <span className="text-[8px] md:text-xs text-white/55 text-center leading-tight line-clamp-2">
              {teacher.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
