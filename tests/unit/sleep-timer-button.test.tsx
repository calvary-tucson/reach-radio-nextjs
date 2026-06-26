import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerButton } from '@/components/home/SleepTimerButton'
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
      <SleepTimerButton />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({ sleepTimerActive: false, sleepTimerPaused: false, remainingSleepSeconds: 0, sleepTimerEndsAt: null })
})

describe('SleepTimerButton', () => {
  it('renders a button with sleep timer label', () => {
    renderWithProvider()
    expect(screen.getByRole('button', { name: /sleep timer/i })).toBeInTheDocument()
  })

  it('does not render a link', () => {
    renderWithProvider()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sheet is not visible before button click', () => {
    renderWithProvider()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the sheet when clicked', () => {
    renderWithProvider()
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows all timer options in the sheet after click', () => {
    renderWithProvider()
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('60m')).toBeInTheDocument()
  })
})
