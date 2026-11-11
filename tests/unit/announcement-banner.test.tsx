import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnnouncementBanner } from '@/components/home/AnnouncementBanner'
import { BANNER_DISMISSED_PREFIX, isBannerExpired, type SiteBanner } from '@/lib/banners'

const banner: SiteBanner = { id: '2026-01-01-test', paragraphs: ['Hello', 'God Bless!'] }

describe('AnnouncementBanner', () => {
  beforeEach(() => localStorage.clear())

  it('shows the message and hides after dismiss, remembering the id', () => {
    render(<AnnouncementBanner banner={banner} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(localStorage.getItem(BANNER_DISMISSED_PREFIX + banner.id)).toBe('1')
  })

  it('stays hidden when this id was already dismissed', () => {
    localStorage.setItem(BANNER_DISMISSED_PREFIX + banner.id, '1')
    render(<AnnouncementBanner banner={banner} />)
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })

  it('shows a new banner id even if an older one was dismissed', () => {
    localStorage.setItem(BANNER_DISMISSED_PREFIX + banner.id, '1')
    render(<AnnouncementBanner banner={{ ...banner, id: '2026-02-02-new' }} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('is marked as web chrome so the native app hides it', () => {
    render(<AnnouncementBanner banner={banner} />)
    expect(screen.getByRole('region', { name: 'Station notice' })).toHaveAttribute('data-web-chrome')
  })
})

describe('isBannerExpired', () => {
  it('never expires without expiresOn', () => {
    expect(isBannerExpired(banner, '2099-01-01')).toBe(false)
  })

  it('is inclusive of the expiry day', () => {
    const b = { ...banner, expiresOn: '2026-11-20' }
    expect(isBannerExpired(b, '2026-11-20')).toBe(false)
    expect(isBannerExpired(b, '2026-11-21')).toBe(true)
  })
})
