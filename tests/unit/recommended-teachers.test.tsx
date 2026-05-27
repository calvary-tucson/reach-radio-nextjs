import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecommendedTeachers } from '@/components/teachers/RecommendedTeachers'
import type { TeacherSummary } from '@/lib/sanity/types'

const mockTeachers = vi.hoisted(() => [
  { name: 'Robert Furrow', slug: 'robert-furrow', title: 'Pastor', photo: null },
  { name: 'David Guzik', slug: 'david-guzik', title: null, photo: null },
] as TeacherSummary[])

vi.mock('@/lib/sanity/client', () => ({
  sanityFetch: vi.fn().mockResolvedValue(mockTeachers),
}))

vi.mock('@/lib/teachers/highlighted', () => ({
  HIGHLIGHTED_TEACHER_SLUGS: ['robert-furrow', 'david-guzik'],
  sortByHighlightedOrder: (teachers: TeacherSummary[], slugs: string[]) =>
    slugs.map((slug) => teachers.find((t) => t.slug === slug)).filter(Boolean),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('RecommendedTeachers', () => {
  it('renders the Recommended heading', async () => {
    const Component = await RecommendedTeachers()
    render(Component)
    expect(screen.getByRole('heading', { name: /recommended/i })).toBeInTheDocument()
  })

  it('renders editorial picks subtitle', async () => {
    const Component = await RecommendedTeachers()
    render(Component)
    expect(screen.getByText(/editorial picks/i)).toBeInTheDocument()
  })

  it('renders a card for each teacher', async () => {
    const Component = await RecommendedTeachers()
    render(Component)
    expect(screen.getByText('Robert Furrow')).toBeInTheDocument()
    expect(screen.getByText('David Guzik')).toBeInTheDocument()
  })

  it('returns null when no teachers found', async () => {
    const { sanityFetch } = await import('@/lib/sanity/client')
    vi.mocked(sanityFetch).mockResolvedValueOnce([])
    const Component = await RecommendedTeachers()
    expect(Component).toBeNull()
  })
})
