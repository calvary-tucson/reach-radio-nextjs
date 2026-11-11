import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DonateCampaignCard } from '@/components/donate/DonateCampaignCard'
import type { DonateCampaign } from '@/lib/donate/campaigns'

const campaign: DonateCampaign = {
  id: '2027-02-15-silent-drive',
  title: 'Silent Drive 2027',
  paragraphs: ['Give during the drive.'],
  schedule: [
    { label: 'Drive begins', when: 'Mon, Mar 8' },
    { label: 'Drive ends', when: 'Sun, Mar 14' },
  ],
  link: { href: 'https://example.com', label: 'Learn more' },
}

describe('DonateCampaignCard', () => {
  it('renders nothing with no campaigns', () => {
    const { container } = render(<DonateCampaignCard campaigns={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders title, paragraphs, schedule and an external link in a new tab', () => {
    render(<DonateCampaignCard campaigns={[campaign]} />)
    expect(screen.getByRole('region', { name: 'Silent Drive 2027' })).toBeInTheDocument()
    expect(screen.getByText('Give during the drive.')).toBeInTheDocument()
    expect(screen.getByText('Drive begins')).toBeInTheDocument()
    expect(screen.getByText('Sun, Mar 14')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Learn more/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders an internal link without target', () => {
    render(<DonateCampaignCard campaigns={[{ ...campaign, link: { href: '/about', label: 'About' } }]} />)
    expect(screen.getByRole('link', { name: 'About' })).not.toHaveAttribute('target')
  })

  it('hides campaigns outside their date window and shows the first active one', () => {
    const expired = { ...campaign, id: '2020-01-01-old', title: 'Old', expiresOn: '2020-12-31' }
    const future = { ...campaign, id: '2999-01-01-later', title: 'Later', startsOn: '2999-01-01' }
    render(<DonateCampaignCard campaigns={[expired, future, campaign]} />)
    expect(screen.queryByText('Old')).not.toBeInTheDocument()
    expect(screen.queryByText('Later')).not.toBeInTheDocument()
    expect(screen.getByText('Silent Drive 2027')).toBeInTheDocument()
  })
})
