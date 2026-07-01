import { describe, it, expect } from 'vitest'
import {
  sanitizeInput,
  checkRateLimit,
  getClientIP,
} from '@/utils/spam-protection'

// Use unique IPs per test to avoid cross-test rate limit state.

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('removes angle brackets', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
  })

  it('removes javascript: protocol', () => {
    expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)')
  })

  it('removes data: protocol', () => {
    expect(sanitizeInput('data:text/html,<h1>x</h1>')).toBe('text/html,h1x/h1')
  })

  it('truncates to maxLength', () => {
    expect(sanitizeInput('abcde', 3)).toBe('abc')
  })

  it('returns empty string for non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeInput(null as any)).toBe('')
  })
})

describe('getClientIP', () => {
  it('prefers cf-connecting-ip', () => {
    const h = new Headers({ 'cf-connecting-ip': '1.2.3.4', 'x-real-ip': '5.6.7.8' })
    expect(getClientIP(h)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const h = new Headers({ 'x-real-ip': '5.6.7.8' })
    expect(getClientIP(h)).toBe('5.6.7.8')
  })

  it('takes only first IP from x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' })
    expect(getClientIP(h)).toBe('1.2.3.4')
  })

  it('returns unknown when no IP headers present', () => {
    expect(getClientIP(new Headers())).toBe('unknown')
  })
})

describe('checkRateLimit', () => {
  it('allows first submission from an IP', () => {
    expect(checkRateLimit('10.0.0.1')).toBe(true)
  })

  it('allows up to 3 submissions from same IP', () => {
    const ip = '10.0.0.2'
    expect(checkRateLimit(ip)).toBe(true)
    expect(checkRateLimit(ip)).toBe(true)
    expect(checkRateLimit(ip)).toBe(true)
  })

  it('blocks 4th submission from same IP', () => {
    const ip = '10.0.0.3'
    checkRateLimit(ip)
    checkRateLimit(ip)
    checkRateLimit(ip)
    expect(checkRateLimit(ip)).toBe(false)
  })

  it('allows different IPs independently', () => {
    checkRateLimit('10.0.1.1')
    checkRateLimit('10.0.1.1')
    checkRateLimit('10.0.1.1')
    expect(checkRateLimit('10.0.1.2')).toBe(true)
  })
})
