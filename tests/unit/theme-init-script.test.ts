import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { THEME_INIT_SCRIPT } from '@/lib/theme/init-script'

type Scheme = 'light' | 'dark' | 'none'

function stubScheme(scheme: Scheme) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(prefers-color-scheme: light)' ? scheme === 'light' : scheme === 'dark',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function run(opts: { scheme: Scheme; cookie?: string; search?: string }) {
  stubScheme(opts.scheme)
  Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: opts.cookie ?? '' })
  window.history.replaceState({}, '', `/${opts.search ?? ''}`)
  new Function(THEME_INIT_SCRIPT)()
  return document.documentElement.classList
}

describe('THEME_INIT_SCRIPT', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    delete (window as { inNativeApp?: unknown }).inNativeApp
    delete (window as { Android?: unknown }).Android
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('web, no saved choice, system light -> light', () => {
    expect(run({ scheme: 'light' }).contains('light')).toBe(true)
  })
  it('web, no saved choice, system dark -> dark', () => {
    expect(run({ scheme: 'dark' }).contains('dark')).toBe(true)
  })
  it('web, no saved choice, no system preference -> dark', () => {
    const cl = run({ scheme: 'none' })
    expect(cl.contains('dark')).toBe(true)
    expect(cl.contains('light')).toBe(false)
  })
  it('web, saved light beats system dark', () => {
    expect(run({ scheme: 'dark', cookie: 'theme=light' }).contains('light')).toBe(true)
  })
  it('web, saved dark beats system light', () => {
    expect(run({ scheme: 'light', cookie: 'theme=dark' }).contains('dark')).toBe(true)
  })
  it('web, saved system follows system light', () => {
    expect(run({ scheme: 'light', cookie: 'theme=system' }).contains('light')).toBe(true)
  })
  it('web, ?theme param beats cookie', () => {
    expect(run({ scheme: 'light', cookie: 'theme=light', search: '?theme=dark' }).contains('dark')).toBe(true)
  })
  it('web, invalid ?theme=lightx is ignored and cookie wins', () => {
    expect(run({ scheme: 'light', cookie: 'theme=dark', search: '?theme=lightx' }).contains('dark')).toBe(true)
  })
  it('web, ?theme=light followed by & still matches', () => {
    expect(run({ scheme: 'dark', cookie: 'theme=dark', search: '?theme=light&x=1' }).contains('light')).toBe(true)
  })
  it('native app via window.inNativeApp: dark even with system light and saved light', () => {
    ;(window as { inNativeApp?: boolean }).inNativeApp = true
    const cl = run({ scheme: 'light', cookie: 'theme=light' })
    expect(cl.contains('dark')).toBe(true)
    expect(cl.contains('light')).toBe(false)
    expect(cl.contains('native-app')).toBe(true)
  })
  it('native app via mobile-app cookie: dark', () => {
    const cl = run({ scheme: 'light', cookie: 'mobile-app=true; theme=light' })
    expect(cl.contains('dark')).toBe(true)
    expect(cl.contains('native-app')).toBe(true)
  })
  it('native Android via window.Android: dark and native-android', () => {
    ;(window as { Android?: unknown }).Android = { postMessage: () => {} }
    const cl = run({ scheme: 'light' })
    expect(cl.contains('dark')).toBe(true)
    expect(cl.contains('native-app')).toBe(true)
    expect(cl.contains('native-android')).toBe(true)
  })
  it('native app: ?theme=light still overrides', () => {
    ;(window as { inNativeApp?: boolean }).inNativeApp = true
    expect(run({ scheme: 'dark', search: '?theme=light' }).contains('light')).toBe(true)
  })
})
