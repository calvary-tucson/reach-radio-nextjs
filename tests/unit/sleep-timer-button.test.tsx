import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerButton } from '@/components/home/SleepTimerButton'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

beforeEach(() => {
  useMediaStore.setState({ sleepTimerActive: false, remainingSleepSeconds: 0 })
})

describe('SleepTimerButton', () => {
  it('renders a button with sleep timer label', () => {
    render(<SleepTimerButton />)
    expect(screen.getByRole('button', { name: /sleep timer/i })).toBeInTheDocument()
  })

  it('does not render a link', () => {
    render(<SleepTimerButton />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sheet is not visible before button click', () => {
    render(<SleepTimerButton />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the sheet when clicked', () => {
    render(<SleepTimerButton />)
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows all timer options in the sheet after click', () => {
    render(<SleepTimerButton />)
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('60m')).toBeInTheDocument()
  })
})
