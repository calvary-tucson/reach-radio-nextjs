import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useTheme, ThemeProvider } from '@/components/theme/ThemeProvider'

function ThemeReader({ onRender }: { onRender: (v: ReturnType<typeof useTheme>) => void }) {
  const ctx = useTheme()
  onRender(ctx)
  return null
}

function wrap(children: React.ReactNode) {
  return <ThemeProvider>{children}</ThemeProvider>
}

type Scheme = 'light' | 'dark' | 'none'

let reducedMotion = false

function stubScheme(scheme: Scheme) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches:
      q === '(prefers-reduced-motion: reduce)'
        ? reducedMotion
        : q === '(prefers-color-scheme: light)'
          ? scheme === 'light'
          : scheme === 'dark',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const cls = () => document.documentElement.classList

describe('ThemeProvider', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: '' })
    document.documentElement.className = ''
    reducedMotion = false
    stubScheme('none')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Reflect.deleteProperty(document, 'startViewTransition')
  })

  it('applies dark class when cookie is dark', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: 'theme=dark' })
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('dark')).toBe(true)
  })

  it('applies light class when cookie is light', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: 'theme=light' })
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('light')).toBe(true)
  })

  it('no cookie + system light -> light', async () => {
    stubScheme('light')
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('light')).toBe(true)
  })

  it('no cookie + system dark -> dark', async () => {
    stubScheme('dark')
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('dark')).toBe(true)
  })

  it('no cookie + no system preference -> dark (not light)', async () => {
    stubScheme('none')
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('dark')).toBe(true)
    expect(cls().contains('light')).toBe(false)
  })

  it('native app (html.native-app) stays dark with system light and a saved light cookie', async () => {
    stubScheme('light')
    document.documentElement.classList.add('native-app')
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: 'theme=light' })
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('dark')).toBe(true)
    expect(cls().contains('light')).toBe(false)
  })

  it('useTheme setTheme updates class', async () => {
    let ctx: ReturnType<typeof useTheme>
    const capture = vi.fn((v) => { ctx = v })
    await act(async () => { render(wrap(<ThemeReader onRender={capture} />)) })
    await act(async () => { ctx!.setTheme('light') })
    expect(cls().contains('light')).toBe(true)
  })

  it('setTheme runs the class swap inside startViewTransition when supported', async () => {
    const start = vi.fn((cb: () => void) => { cb(); return { finished: Promise.resolve() } })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    let ctx: ReturnType<typeof useTheme>
    await act(async () => { render(wrap(<ThemeReader onRender={(v) => { ctx = v }} />)) })
    await act(async () => { ctx!.setTheme('light') })
    expect(start).toHaveBeenCalledTimes(1)
    expect(cls().contains('light')).toBe(true)
  })

  it('setTheme skips the transition under reduced motion', async () => {
    reducedMotion = true
    stubScheme('none')
    const start = vi.fn()
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    let ctx: ReturnType<typeof useTheme>
    await act(async () => { render(wrap(<ThemeReader onRender={(v) => { ctx = v }} />)) })
    await act(async () => { ctx!.setTheme('light') })
    expect(start).not.toHaveBeenCalled()
    expect(cls().contains('light')).toBe(true)
  })

  it('removes the theme-transition class when the transition finishes', async () => {
    const start = vi.fn((cb: () => void) => { cb(); return { finished: Promise.resolve() } })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    let ctx: ReturnType<typeof useTheme>
    await act(async () => { render(wrap(<ThemeReader onRender={(v) => { ctx = v }} />)) })
    await act(async () => { ctx!.setTheme('light') })
    await act(async () => { await Promise.resolve() })
    expect(cls().contains('theme-transition')).toBe(false)
  })
})
