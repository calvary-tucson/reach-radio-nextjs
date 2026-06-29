import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSearchParams } from 'next/navigation'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: () => '/teachers/search',
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const teachers: TeacherSummary[] = [
  { name: 'Jack Hibbs', slug: 'jack-hibbs', title: 'Real Life Radio', photo: null },
  { name: 'Alistair Begg', slug: 'alistair-begg', title: 'Truth For Life', photo: null },
  { name: 'John MacArthur', slug: 'john-macarthur', title: 'Grace to You', photo: null },
]

const scheduleTeachers: TeacherWithSchedule[] = teachers.map((t) => ({
  ...t,
  schedule: [],
}))

describe('TeacherSearchClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows all teachers initially', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByText('Jack Hibbs')).toBeInTheDocument()
    expect(screen.getByText('Alistair Begg')).toBeInTheDocument()
    expect(screen.getByText('John MacArthur')).toBeInTheDocument()
  })

  it('renders day filter chips', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByRole('button', { name: 'Mon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sun' })).toBeInTheDocument()
  })

  it('shows results count', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByText(/3 teachers found/i)).toBeInTheDocument()
  })

  it('filters teachers by name from URL query', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('q=begg') as ReturnType<typeof useSearchParams>)
    render(<TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />)
    expect(screen.getByText('Alistair Begg')).toBeInTheDocument()
    expect(screen.queryByText('Jack Hibbs')).not.toBeInTheDocument()
    expect(screen.queryByText('John MacArthur')).not.toBeInTheDocument()
  })

  it('shows empty state when no results match URL query', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('q=zzznomatch') as ReturnType<typeof useSearchParams>)
    render(<TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />)
    expect(screen.getByText(/no teachers found/i)).toBeInTheDocument()
  })
})
