import { describe, it, expect } from 'vitest'

// Mirrors the exact hex values used by TeacherInfoChip.tsx's `accent`
// variant in light mode (light:text-green-700 on light:bg-green-100,
// both from src/app/globals.css's --color-green-* scale). If either token
// changes, update both this test and the component together.
const TEXT_GREEN_700 = '#4F712D'
const BG_GREEN_100 = '#E6F0DB'

function srgbToLinear(channel: number): number {
  const s = channel / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('TeacherInfoChip accent variant — light-mode contrast', () => {
  it('text-green-700 on bg-green-100 clears WCAG AA 4.5:1 for normal text', () => {
    expect(contrastRatio(TEXT_GREEN_700, BG_GREEN_100)).toBeGreaterThanOrEqual(4.5)
  })
})
