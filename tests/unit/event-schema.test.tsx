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

  it('each ListItem has BroadcastEvent type with name, broadcaster, and publishedOn', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    const first = json.itemListElement[0].item
    expect(first['@type']).toBe('BroadcastEvent')
    expect(first.name).toBe('Grace to You')
    expect(first.broadcaster.name).toBe('Reach Radio')
    expect(first.publishedOn['@type']).toBe('BroadcastService')
    expect(first.publishedOn.url).toBe('https://reach.radio')
    expect(first.organizer).toBeUndefined()
  })

  it('eventSchedule has Schedule type with byDay and ISO times', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    const first = json.itemListElement[0].item
    expect(first.eventSchedule['@type']).toBe('Schedule')
    expect(first.eventSchedule.byDay).toBe('https://schema.org/Sunday')
    expect(first.eventSchedule.startTime).toBe('09:00')
    expect(first.eventSchedule.endTime).toBe('10:00')
    const second = json.itemListElement[1].item
    expect(second.eventSchedule.byDay).toBe('https://schema.org/Monday')
    expect(second.eventSchedule.startTime).toBe('07:00')
    expect(second.eventSchedule.endTime).toBe('07:30')
  })

  it('Mon-Fri day maps to an array of weekday URLs', () => {
    const weekdayEvents = [
      { name: 'Daily Show', startTime: '8:00 AM', endTime: '9:00 AM', day: 'Mon-Fri' },
    ]
    const { container } = render(<EventSchema events={weekdayEvents} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    const byDay = json.itemListElement[0].item.eventSchedule.byDay
    expect(Array.isArray(byDay)).toBe(true)
    expect(byDay).toHaveLength(5)
    expect(byDay).toContain('https://schema.org/Monday')
    expect(byDay).toContain('https://schema.org/Friday')
  })

  it('ListItem positions are sequential starting at 1', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    json.itemListElement.forEach((item: { position: number }, index: number) => {
      expect(item.position).toBe(index + 1)
    })
  })

  it('renders empty ItemList when events array is empty', () => {
    const { container } = render(<EventSchema events={[]} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    expect(json['@type']).toBe('ItemList')
    expect(json.itemListElement).toHaveLength(0)
  })

  it('escapes </script> to prevent XSS injection', () => {
    const xssEvents = [
      { name: 'Test</script><script>alert(1)</script>', startTime: '9:00 AM', endTime: '10:00 AM', day: 'Sunday' },
    ]
    const { container } = render(<EventSchema events={xssEvents} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    expect(script.innerHTML).not.toContain('</script>')
    expect(script.innerHTML).toContain('<\\/script>')
  })
})
