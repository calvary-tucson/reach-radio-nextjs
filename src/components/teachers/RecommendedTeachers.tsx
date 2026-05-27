import { sanityFetch } from '@/lib/sanity/client'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherCard } from '@/components/teachers/TeacherCard'

export async function RecommendedTeachers() {
  const raw = await sanityFetch<TeacherSummary[]>(
    highlightedTeachersQuery,
    { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
    { tags: ['teachers'] }
  )

  const teachers = sortByHighlightedOrder(raw, HIGHLIGHTED_TEACHER_SLUGS)

  if (teachers.length === 0) return null

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-white font-bold text-lg uppercase">Recommended</h2>
        <p className="text-white/50 text-sm">Our editorial picks</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {teachers.map((teacher, index) => (
          <TeacherCard key={teacher.slug} teacher={teacher} index={index} />
        ))}
      </div>
    </section>
  )
}
