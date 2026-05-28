import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
  it('renders search input', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByRole('textbox', { name: /search teachers/i })).toBeInTheDocument()
  })

  it('shows all teachers initially', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByText('Jack Hibbs')).toBeInTheDocument()
    expect(screen.getByText('Alistair Begg')).toBeInTheDocument()
    expect(screen.getByText('John MacArthur')).toBeInTheDocument()
  })

  it('filters teachers by name as user types', () => {
    vi.useFakeTimers()
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    const input = screen.getByRole('textbox', { name: /search teachers/i })
    act(() => {
      fireEvent.change(input, { target: { value: 'begg' } })
      vi.runAllTimers()
    })
    expect(screen.getByText('Alistair Begg')).toBeInTheDocument()
    expect(screen.queryByText('Jack Hibbs')).not.toBeInTheDocument()
    expect(screen.queryByText('John MacArthur')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows empty state when no results', () => {
    vi.useFakeTimers()
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    const input = screen.getByRole('textbox', { name: /search teachers/i })
    act(() => {
      fireEvent.change(input, { target: { value: 'zzznomatch' } })
      vi.runAllTimers()
    })
    expect(screen.getByText(/no teachers found/i)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('renders day filter chips', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByRole('button', { name: 'Mon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sun' })).toBeInTheDocument()
  })

  it('renders sort options', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByRole('button', { name: 'A–Z' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Z–A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Most on air' })).toBeInTheDocument()
  })

  it('sorts teachers A–Z when A–Z selected', async () => {
    const user = userEvent.setup()
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    await user.click(screen.getByRole('button', { name: 'A–Z' }))
    const links = screen.getAllByRole('link')
    const teacherLinks = links.filter((l) => /^\/teachers\/\w/.test(l.getAttribute('href') ?? ''))
    const names = teacherLinks.map((l) => l.textContent?.trim()).filter(Boolean)
    expect(names[0]).toContain('Alistair Begg')
  })

  it('shows results count', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByText(/3 teachers found/i)).toBeInTheDocument()
  })

  it('clear search button removes query', async () => {
    const user = userEvent.setup()
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    const input = screen.getByRole('textbox', { name: /search teachers/i })
    await user.type(input, 'begg')
    await user.click(screen.getByRole('button', { name: /clear search/i }))
    expect(input).toHaveValue('')
    expect(screen.getByText('Jack Hibbs')).toBeInTheDocument()
  })
})
