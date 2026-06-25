import { describe, it, expect } from 'vitest'

function stripJsonp(text: string): string {
  return text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '')
}

describe('JSONP strip', () => {
  it('strips simple wrapper', () => {
    const result = JSON.parse(stripJsonp('({"title":"Reach Radio"});'))
    expect(result.title).toBe('Reach Radio')
  })

  it('strips named callback', () => {
    const result = JSON.parse(stripJsonp('callback({"title":"Test"});'))
    expect(result.title).toBe('Test')
  })

  it('handles trailing whitespace', () => {
    const result = JSON.parse(stripJsonp('cb({"title":"Test"});  \n'))
    expect(result.title).toBe('Test')
  })

  it('strips old format without semicolon', () => {
    const result = JSON.parse(stripJsonp('({"title":"Test"})'))
    expect(result.title).toBe('Test')
  })
})
