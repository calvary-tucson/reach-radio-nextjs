import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SleepTimerIndicator } from '@/components/media-bar/SleepTimerIndicator'
import { GlobalSleepTimerSheet } from '@/components/media-bar/GlobalSleepTimerSheet'
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
      <GlobalSleepTimerSheet />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
    sleepTimerSheetOpen: false,
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

  it('keeps the sheet mounted when the timer becomes inactive while open (cancel/expiry mid-close)', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 60 })
    renderWithProvider()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Simulate cancelSleepTimer() flipping the store flag before the sheet's
    // own 280ms close animation/timer has completed.
    act(() => {
      useMediaStore.setState({ sleepTimerActive: false })
    })

    // The trigger button should disappear immediately...
    expect(screen.queryByRole('button', { name: /sleep timer active/i })).not.toBeInTheDocument()
    // ...but the sheet must still be mounted so it can finish its close
    // animation and restore focus. GlobalSleepTimerSheet's mount depends
    // only on sleepTimerSheetOpen, never on sleepTimerActive, so this holds
    // structurally regardless of which trigger opened it.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
