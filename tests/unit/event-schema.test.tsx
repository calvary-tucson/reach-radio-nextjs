import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EventSchema } from '@/components/seo/EventSchema'

const events = [
  { name: 'Grace to You', startTime: '9:00 AM', endTime: '10:00 AM', day: 'Sunday' },
  { name: 'Through the Bible', startTime: '7:00 AM', endTime: '7:30 AM', day: 'Monday' },
]

describe('EventSchema', () => {
  it('renders a script tag with type application/ld+json', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeTruthy()
  })

  it('renders an ItemList with correct number of ListItems', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    expect(json['@type']).toBe('ItemList')
    expect(json.itemListElement).toHaveLength(2)
  })

  it('each ListItem has Event type with name and organizer', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    const first = json.itemListElement[0].item
    expect(first['@type']).toBe('Event')
    expect(first.name).toBe('Grace to You')
    expect(first.organizer.name).toBe('Reach Radio')
  })
})
