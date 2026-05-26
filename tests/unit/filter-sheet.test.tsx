import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterSheet } from '@/components/teachers/FilterSheet'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

describe('FilterSheet', () => {
  it('renders nothing when closed', () => {
    render(
      <FilterSheet
        open={false}
        onClose={vi.fn()}
        onApply={vi.fn()}
        initialSort={undefined}
        initialDays={[]}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders sort options and day chips when open', () => {
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={vi.fn()}
        initialSort={undefined}
        initialDays={[]}
      />
    )
    expect(screen.getByText('A – Z')).toBeInTheDocument()
    expect(screen.getByText('Z – A')).toBeInTheDocument()
    expect(screen.getByText('Most on air')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('calls onApply with selected sort and days when Apply clicked', async () => {
    const onApply = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <FilterSheet
        open={true}
        onClose={onClose}
        onApply={onApply}
        initialSort={undefined}
        initialDays={[]}
      />
    )
    await user.click(screen.getByText('Most on air'))
    await user.click(screen.getByText('Mon'))
    await user.click(screen.getByRole('button', { name: /apply/i }))
    expect(onApply).toHaveBeenCalledWith({ sort: 'most-on-air', days: ['Monday'] })
    expect(onClose).toHaveBeenCalled()
  })

  it('resets pending state and calls onApply with empty when Clear all clicked', async () => {
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={onApply}
        initialSort="name-desc"
        initialDays={['Monday']}
      />
    )
    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onApply).toHaveBeenCalledWith({ sort: undefined, days: [] })
  })

  it('toggles day chip off when clicked twice', async () => {
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={onApply}
        initialSort={undefined}
        initialDays={[]}
      />
    )
    await user.click(screen.getByText('Mon'))
    await user.click(screen.getByText('Mon'))
    await user.click(screen.getByRole('button', { name: /apply/i }))
    expect(onApply).toHaveBeenCalledWith({ sort: undefined, days: [] })
  })
})
