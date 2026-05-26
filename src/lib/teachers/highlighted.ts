import type { TeacherSummary } from '@/lib/sanity/types'

export const HIGHLIGHTED_TEACHER_SLUGS = [
  'robert-furrow',
  'david-guzik',
  'ed-taylor',
  'gary-hamrick',
  'scott-richards',
] as const

export function sortByHighlightedOrder(
  teachers: TeacherSummary[],
  slugs: readonly string[]
): TeacherSummary[] {
  return slugs
    .map((slug) => teachers.find((t) => t.slug === slug))
    .filter((t): t is TeacherSummary => t !== undefined)
}
