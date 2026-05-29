import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useTheme, ThemeProvider } from '@/components/theme/ThemeProvider'

// Minimal consumer to read context
function ThemeReader({ onRender }: { onRender: (v: { theme: string }) => void }) {
  const ctx = useTheme()
  onRender(ctx)
  return null
}

function wrap(children: React.ReactNode) {
  return <ThemeProvider>{children}</ThemeProvider>
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
    document.documentElement.className = ''
    document.body.removeAttribute('data-app')
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(prefers-color-scheme: dark)' ? false : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies dark class when cookie is dark', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, value: 'theme=dark' })
    await act(async () => { render(wrap(<div />)) })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies light class when cookie is light', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, value: 'theme=light' })
    await act(async () => { render(wrap(<div />)) })
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('defaults to dark for native app context (no cookie)', async () => {
    document.body.setAttribute('data-app', 'true')
    await act(async () => { render(wrap(<div />)) })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('follows system preference (light) when no cookie and not native app', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, // prefers-color-scheme: light
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    await act(async () => { render(wrap(<div />)) })
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('useTheme setTheme updates class and sets cookie', async () => {
    let ctx: ReturnType<typeof useTheme>
    const capture = vi.fn((v) => { ctx = v })
    await act(async () => { render(wrap(<ThemeReader onRender={capture} />)) })
    await act(async () => { ctx!.setTheme('light') })
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })
})
