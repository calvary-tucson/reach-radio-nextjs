import type { TeacherSummary } from '@/lib/sanity/types'

export function filterTeachers(teachers: TeacherSummary[], query: string): TeacherSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return teachers
  return teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q)
  )
}
