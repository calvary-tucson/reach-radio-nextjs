import { describe, it, expect } from 'vitest'
import { isTheme, pickTheme, resolveTheme } from '@/lib/theme/resolve-theme'

describe('isTheme', () => {
  it('accepts the three values only', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('system')).toBe(true)
    expect(isTheme('blue')).toBe(false)
    expect(isTheme(null)).toBe(false)
    expect(isTheme(undefined)).toBe(false)
  })
})

describe('pickTheme', () => {
  it('web: defaults to system', () => {
    expect(pickTheme({ param: null, cookie: null, isNativeApp: false })).toBe('system')
  })
  it('web: saved cookie wins over default', () => {
    expect(pickTheme({ param: null, cookie: 'light', isNativeApp: false })).toBe('light')
  })
  it('web: param wins over cookie', () => {
    expect(pickTheme({ param: 'dark', cookie: 'light', isNativeApp: false })).toBe('dark')
  })
  it('web: invalid param is ignored', () => {
    expect(pickTheme({ param: 'blue', cookie: 'light', isNativeApp: false })).toBe('light')
  })
  it('native app: always dark, ignores cookie', () => {
    expect(pickTheme({ param: null, cookie: 'light', isNativeApp: true })).toBe('dark')
    expect(pickTheme({ param: null, cookie: null, isNativeApp: true })).toBe('dark')
  })
  it('native app: param still overrides', () => {
    expect(pickTheme({ param: 'light', cookie: null, isNativeApp: true })).toBe('light')
  })
})

describe('resolveTheme', () => {
  it('system + prefers light -> light', () => {
    expect(resolveTheme('system', true)).toBe('light')
  })
  it('system + not prefers light (dark or no preference) -> dark', () => {
    expect(resolveTheme('system', false)).toBe('dark')
  })
  it('explicit choices ignore the system', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})
