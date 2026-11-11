import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnnouncementBanner } from '@/components/home/AnnouncementBanner'
import { BANNER_DISMISSED_PREFIX, type SiteBanner } from '@/lib/banners'
import { isInDateWindow } from '@/lib/date-window'

const banner: SiteBanner = { id: '2026-01-01-test', paragraphs: ['Hello', 'God Bless!'] }
const other: SiteBanner = { id: '2026-02-02-other', paragraphs: ['Second'] }

describe('AnnouncementBanner', () => {
  beforeEach(() => localStorage.clear())

  it('shows the message and hides after dismiss, remembering the id', () => {
    render(<AnnouncementBanner banners={[banner]} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(localStorage.getItem(BANNER_DISMISSED_PREFIX + banner.id)).toBe('1')
  })

  it('stays hidden when this id was already dismissed', () => {
    localStorage.setItem(BANNER_DISMISSED_PREFIX + banner.id, '1')
    render(<AnnouncementBanner banners={[banner]} />)
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })

  it('falls through to the next banner when the first was dismissed', () => {
    localStorage.setItem(BANNER_DISMISSED_PREFIX + banner.id, '1')
    render(<AnnouncementBanner banners={[banner, other]} />)
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('shows a new banner id even if an older one was dismissed', () => {
    localStorage.setItem(BANNER_DISMISSED_PREFIX + banner.id, '1')
    render(<AnnouncementBanner banners={[{ ...banner, id: '2027-02-02-new' }]} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders nothing when the date window has passed or not started', () => {
    const { rerender } = render(<AnnouncementBanner banners={[{ ...banner, expiresOn: '2000-01-01' }]} />)
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    rerender(<AnnouncementBanner banners={[{ ...banner, startsOn: '2999-01-01' }]} />)
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })

  it('renders an internal link without target and an external link in a new tab', () => {
    const { rerender } = render(<AnnouncementBanner banners={[{ ...banner, link: { href: '/about', label: 'About us' } }]} />)
    expect(screen.getByRole('link', { name: 'About us' })).not.toHaveAttribute('target')
    rerender(<AnnouncementBanner banners={[{ ...banner, link: { href: 'https://example.com', label: 'Sign up' } }]} />)
    const ext = screen.getByRole('link', { name: 'Sign up' })
    expect(ext).toHaveAttribute('target', '_blank')
    expect(ext).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('is marked as web chrome so the native app hides it', () => {
    render(<AnnouncementBanner banners={[banner]} />)
    expect(screen.getByRole('region', { name: 'Station notice' })).toHaveAttribute('data-web-chrome')
  })
})

describe('isInDateWindow', () => {
  it('is always in window without dates', () => {
    expect(isInDateWindow(banner, '2099-01-01')).toBe(true)
  })

  it('is inclusive of the start and expiry days', () => {
    const b = { ...banner, startsOn: '2026-11-10', expiresOn: '2026-11-20' }
    expect(isInDateWindow(b, '2026-11-09')).toBe(false)
    expect(isInDateWindow(b, '2026-11-10')).toBe(true)
    expect(isInDateWindow(b, '2026-11-20')).toBe(true)
    expect(isInDateWindow(b, '2026-11-21')).toBe(false)
  })
})
