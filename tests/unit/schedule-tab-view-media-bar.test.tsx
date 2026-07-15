import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ScheduleTabView } from '@/components/teachers/ScheduleTabView'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/teachers/ScheduleCardList', () => ({
  ScheduleCardList: () => <div>card-list</div>,
}))

vi.mock('@/components/teachers/ScheduleWeekCards', () => ({
  ScheduleWeekCards: () => <div>week-cards</div>,
}))

beforeEach(() => {
  useMediaStore.setState({ showMediaBar: true })
})

describe('ScheduleTabView — day picker media bar visibility', () => {
  it('hides the on-page media bar while the day-picker sheet is open and restores it on close', () => {
    vi.useFakeTimers()
    render(<ScheduleTabView scheduleTeachers={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /today|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i }))
    expect(useMediaStore.getState().showMediaBar).toBe(false)

    fireEvent.keyDown(document, { key: 'Escape' })
    act(() => { vi.advanceTimersByTime(300) })
    expect(useMediaStore.getState().showMediaBar).toBe(true)
    vi.useRealTimers()
  })
})
