import { sanityFetch } from '@/lib/sanity/client'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherModalLink } from '@/components/teachers/TeacherModalLink'

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
      <p className="text-[11px] md:text-sm font-bold uppercase tracking-[0.08em] text-white/55 light:text-gray-500 px-0 mb-[10px] md:mb-3">
        Recommended
      </p>
      <div className="relative">
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-1 pr-20 md:pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {teachers.map((teacher, index) => (
            <TeacherModalLink
              key={teacher.slug}
              slug={teacher.slug}
              name={teacher.name}
              className="flex flex-col items-center gap-[5px] md:gap-2 flex-shrink-0 w-[72px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
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
              <span className="text-xs md:text-[13px] text-white/75 light:text-gray-700 text-center leading-tight line-clamp-2">
                {teacher.name}
              </span>
            </TeacherModalLink>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[oklch(24%_0.05_280)] light:from-white from-30% to-transparent md:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 flex items-center justify-end pr-1 md:hidden">
          <svg className="w-4 h-4 text-white/50 light:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </section>
  )
}
