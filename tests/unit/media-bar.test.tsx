import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MediaBar } from '@/components/media-bar/MediaBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

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
      <MediaBar />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({
    showMediaBar: true,
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
  })
})

describe('MediaBar — sleep timer indicator', () => {
  it('does not show a sleep timer indicator when no timer is active', () => {
    renderWithProvider()
    expect(screen.queryByRole('button', { name: /sleep timer/i })).not.toBeInTheDocument()
  })

  it('shows a sleep timer indicator when a timer is active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 120 })
    renderWithProvider()
    expect(screen.getByRole('button', { name: /sleep timer active/i })).toBeInTheDocument()
  })
})
