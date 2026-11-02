import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'

vi.mock('next/image', () => ({
  default: ({ alt, fill: _fill, ...props }: { alt: string; fill?: boolean; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

describe('TeacherAvatar', () => {
  it('anchors the photo crop to the top so heads are not cut off', () => {
    render(<TeacherAvatar name="Jane Doe" photo="/jane.jpg" size="md" shape="circle" />)
    const img = screen.getByRole('img', { name: 'Jane Doe' })
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('object-top')
  })

  it('renders initials when there is no photo', () => {
    render(<TeacherAvatar name="Jane Doe" size="md" shape="circle" />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })
})
