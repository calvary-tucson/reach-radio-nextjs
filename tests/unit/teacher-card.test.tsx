import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import type { TeacherSummary } from '@/lib/sanity/types'

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    ViewTransition: ({ children }: { children: React.ReactNode }) => children,
  }
})

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const teacher: TeacherSummary = {
  name: 'John MacArthur',
  slug: 'john-macarthur',
  title: 'Grace to You',
  photo: 'https://cdn.sanity.io/images/test/production/photo.jpg',
}

describe('TeacherCard', () => {
  it('renders teacher name', () => {
    render(<TeacherCard teacher={teacher} />)
    expect(screen.getByText('John MacArthur')).toBeInTheDocument()
  })

  it('renders link with aria-label containing name and title', () => {
    render(<TeacherCard teacher={teacher} />)
    expect(screen.getByRole('link', { name: 'John MacArthur — Grace to You' })).toBeInTheDocument()
  })

  it('renders no image when photo is absent', () => {
    render(<TeacherCard teacher={{ ...teacher, photo: '' }} />)
    expect(screen.queryByAltText('John MacArthur')).not.toBeInTheDocument()
  })

  it('links to teacher detail page', () => {
    render(<TeacherCard teacher={teacher} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/teachers/john-macarthur')
  })

  it('accepts optional index prop without error', () => {
    expect(() => render(<TeacherCard teacher={teacher} index={3} />)).not.toThrow()
  })
})
