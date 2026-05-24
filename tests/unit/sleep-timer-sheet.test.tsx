import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerSheet } from '@/components/home/SleepTimerSheet'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    remainingSleepSeconds: 0,
  })
})

describe('SleepTimerSheet', () => {
  it('renders nothing when open is false', () => {
    render(<SleepTimerSheet open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders timer options when open and timer not active', () => {
    render(<SleepTimerSheet open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('30m')).toBeInTheDocument()
    expect(screen.getByText('60m')).toBeInTheDocument()
  })

  it('renders countdown when open and timer active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 300 })
    render(<SleepTimerSheet open={true} onClose={vi.fn()} />)
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel timer/i })).toBeInTheDocument()
  })

  it('starts timer and calls onClose when option selected', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<SleepTimerSheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('15m'))
    expect(useMediaStore.getState().sleepTimerActive).toBe(true)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(900)
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('cancels timer and calls onClose when cancel clicked', () => {
    vi.useFakeTimers()
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 300 })
    const onClose = vi.fn()
    render(<SleepTimerSheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel timer/i }))
    expect(useMediaStore.getState().sleepTimerActive).toBe(false)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(0)
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls onClose when backdrop clicked', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<SleepTimerSheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
