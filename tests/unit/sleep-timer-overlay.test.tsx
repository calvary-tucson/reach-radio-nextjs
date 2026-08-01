import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SleepTimerOverlay } from '@/components/home/SleepTimerOverlay'
import { useMediaStore } from '@/lib/store/media-store'

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
  })
})

describe('SleepTimerOverlay', () => {
  it('renders nothing when the timer is not active', () => {
    render(<SleepTimerOverlay />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the formatted countdown when active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 125 })
    render(<SleepTimerOverlay />)
    expect(screen.getByText('02:05')).toBeInTheDocument()
  })

  it('shows a "Sleep Timer" label when active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 125 })
    render(<SleepTimerOverlay />)
    expect(screen.getByText('Sleep Timer')).toBeInTheDocument()
  })

  it('applies an entrance fade-in animation to the dialog', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 125 })
    render(<SleepTimerOverlay />)
    expect(screen.getByRole('dialog')).toHaveClass('motion-safe:animate-in', 'motion-safe:fade-in-0')
  })
})
