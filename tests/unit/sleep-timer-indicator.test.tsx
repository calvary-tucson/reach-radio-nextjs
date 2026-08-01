import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerIndicator } from '@/components/media-bar/SleepTimerIndicator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

function renderWithProvider() {
  return render(
    <TooltipProvider>
      <SleepTimerIndicator />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
  })
})

describe('SleepTimerIndicator', () => {
  it('renders nothing when no sleep timer is active', () => {
    renderWithProvider()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a button labeled with the remaining minutes when active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 305 })
    renderWithProvider()
    expect(screen.getByRole('button', { name: /sleep timer active, 6 minutes remaining/i })).toBeInTheDocument()
  })

  it('opens the sleep timer sheet when clicked', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 60 })
    renderWithProvider()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
