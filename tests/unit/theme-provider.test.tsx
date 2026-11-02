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

interface VtRun {
  finish: () => void
  fail: (e: Error) => void
}

/** Fake startViewTransition: runs the swap like a browser (async errors surface via promises) and exposes a deferred `finished`. */
function installViewTransition(opts: { swapThrows?: boolean } = {}) {
  const runs: VtRun[] = []
  const start = vi.fn((cb: () => void) => {
    let resolveFinished!: () => void
    let rejectFinished!: (e: Error) => void
    const finished = new Promise<void>((res, rej) => { resolveFinished = res; rejectFinished = rej })
    const ready = Promise.resolve()
    const updateCallbackDone = new Promise<void>((res, rej) => {
      try {
        if (opts.swapThrows) throw new Error('swap failed')
        cb()
        res()
      } catch (e) {
        rej(e)
        rejectFinished(e as Error)
        ready.catch(() => {})
      }
    })
    runs.push({ finish: resolveFinished, fail: rejectFinished })
    return { finished, ready, updateCallbackDone }
  })
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
  return { start, runs }
}

async function mountCtx() {
  const current = { current: undefined as unknown as ReturnType<typeof useTheme> }
  await act(async () => { render(wrap(<ThemeReader onRender={(v) => { current.current = v }} />)) })
  return current
}

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
    const { start } = installViewTransition()
    const ctx = await mountCtx()
    await act(async () => { ctx.current.setTheme('light') })
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

  it('keeps theme-transition while running and removes it once finished resolves', async () => {
    const { runs } = installViewTransition()
    const ctx = await mountCtx()
    await act(async () => { ctx.current.setTheme('light') })
    expect(cls().contains('theme-transition')).toBe(true)
    await act(async () => { runs[0].finish() })
    expect(cls().contains('theme-transition')).toBe(false)
  })

  it('overlapping transitions: class stays until the LATEST one finishes', async () => {
    const { runs } = installViewTransition()
    const ctx = await mountCtx()
    await act(async () => { ctx.current.setTheme('light') })
    await act(async () => { ctx.current.setTheme('dark') })
    expect(runs).toHaveLength(2)
    await act(async () => { runs[0].finish() })
    expect(cls().contains('theme-transition')).toBe(true)
    await act(async () => { runs[1].finish() })
    expect(cls().contains('theme-transition')).toBe(false)
  })

  it('rejected finished: no unhandled rejection and class is removed', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { runs } = installViewTransition()
      const ctx = await mountCtx()
      await act(async () => { ctx.current.setTheme('light') })
      await act(async () => { runs[0].fail(new Error('skipped')) })
      await new Promise((r) => setTimeout(r, 10))
      expect(cls().contains('theme-transition')).toBe(false)
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('throwing swap: class is removed and no unhandled rejection', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { runs } = installViewTransition({ swapThrows: true })
      const ctx = await mountCtx()
      await act(async () => { ctx.current.setTheme('light') })
      await new Promise((r) => setTimeout(r, 10))
      expect(runs).toHaveLength(1)
      expect(cls().contains('theme-transition')).toBe(false)
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('no-op toggle (already-applied theme) does not start a transition', async () => {
    const { start } = installViewTransition()
    document.documentElement.classList.add('dark')
    const ctx = await mountCtx()
    start.mockClear()
    await act(async () => { ctx.current.setTheme('dark') })
    expect(start).not.toHaveBeenCalled()
    expect(cls().contains('theme-transition')).toBe(false)
    expect(document.cookie).toContain('theme=dark')
  })

  it("no-op toggle resolves 'system' via the light media query", async () => {
    stubScheme('light')
    document.documentElement.classList.add('light')
    const { start } = installViewTransition()
    const ctx = await mountCtx()
    start.mockClear()
    await act(async () => { ctx.current.setTheme('system') })
    expect(start).not.toHaveBeenCalled()
    expect(ctx.current.theme).toBe('system')
  })
})
