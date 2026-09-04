import { describe, it, expect } from 'vitest'
import { getDonateCtaCopy } from '@/lib/donate/cta'

describe('getDonateCtaCopy', () => {
  it('omits target and makes no "stays right where you left it" claim in-app', () => {
    const result = getDonateCtaCopy(true)
    expect(result.target).toBeUndefined()
    expect(result.reassurance).toBe("Give once or set up recurring giving on PushPay's secure site.")
  })

  it('opens a new tab and reassures the user on web', () => {
    const result = getDonateCtaCopy(false)
    expect(result.target).toBe('_blank')
    expect(result.reassurance).toBe(
      "Give once or set up recurring giving — you'll finish on PushPay's secure site, which opens in a new tab. Reach Radio stays right where you left it."
    )
  })
})
