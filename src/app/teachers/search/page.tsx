import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function TeacherSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const trimmed = q.trim().slice(0, 100)
  redirect(trimmed ? `/teachers?q=${encodeURIComponent(trimmed)}` : '/teachers')
}
