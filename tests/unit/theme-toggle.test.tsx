import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

vi.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: vi.fn(() => ({ theme: 'dark', setTheme: vi.fn() })),
}))

describe('ThemeToggle', () => {
  it('renders Light, Dark, System buttons', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument()
  })

  it('marks active theme button as pressed', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls setTheme when a button is clicked', async () => {
    const setTheme = vi.fn()
    const { useTheme } = await import('@/components/theme/ThemeProvider')
    vi.mocked(useTheme).mockReturnValue({ theme: 'dark', setTheme })
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: /light/i }))
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
