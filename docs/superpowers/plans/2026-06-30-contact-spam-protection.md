# Contact Form Spam Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rate limiting, input sanitization, and a link-count check to the contact form server action. reCAPTCHA v3 + honeypot + timing already handle primary spam blocking — this layer adds defense in depth, not theater.

**Architecture:** A pure-utility module `src/utils/spam-protection.ts` exports `getClientIP`, `checkRateLimit`, and `sanitizeInput`. The server action calls rate limit before reCAPTCHA, then sanitizes before forwarding to Formspree. A single inline link-count check catches the one content signal with real correlation to spam. No keyword lists, no UA sniffing, no disposable-email lists.

**Tech Stack:** TypeScript strict, vitest, Next.js server actions (no new dependencies).

## Global Constraints

- TypeScript strict mode — no `any` in exported signatures
- No new npm dependencies
- Rate limiting is in-memory and explicitly best-effort — do NOT introduce Redis or external services
- Do NOT add keyword lists, bot UA patterns, disposable email lists, geographic blocking, or scoring systems — all theater
- All commits must use `fix(about):` or `feat(about):` scope per AGENTS.md

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/spam-protection.ts` | Create | `getClientIP`, `checkRateLimit`, `sanitizeInput` |
| `src/actions/contact.ts` | Modify | Wire in rate limit, link-count check, sanitization |
| `tests/unit/spam-protection.test.ts` | Create | Unit tests for every exported function |
| `tests/unit/action-contact.test.ts` | Modify | Add rate limit and sanitization test cases |

---

## Task 1: Create `src/utils/spam-protection.ts`

**Files:**
- Create: `src/utils/spam-protection.ts`
- Test: `tests/unit/spam-protection.test.ts`

**Interfaces:**
- Produces: `getClientIP()`, `checkRateLimit()`, `sanitizeInput()`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/spam-protection.test.ts`:

```typescript
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

  it('removes inline event handlers', () => {
    expect(sanitizeInput('onclick=evil()')).toBe('evil()')
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/spam-protection.test.ts
```

Expected: FAIL — `Cannot find module '@/utils/spam-protection'`

- [ ] **Step 3: Create `src/utils/spam-protection.ts`**

```typescript
// In-memory store for rate limiting.
// Best-effort only — resets on Vercel cold starts. Acceptable for low-volume contact form.
const submissionHistory = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const MAX_SUBMISSIONS = 3

export function getClientIP(headers: { get(name: string): string | null }): string {
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf
  const real = headers.get('x-real-ip')
  if (real) return real
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS

  for (const [key, timestamps] of submissionHistory) {
    const fresh = timestamps.filter(t => t > windowStart)
    if (fresh.length === 0) submissionHistory.delete(key)
    else submissionHistory.set(key, fresh)
  }

  const timestamps = submissionHistory.get(ip) ?? []
  const recent = timestamps.filter(t => t > windowStart)

  if (recent.length >= MAX_SUBMISSIONS) return false
  submissionHistory.set(ip, [...recent, now])
  return true
}

export function sanitizeInput(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/data:/gi, '')
    .substring(0, maxLength)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/spam-protection.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/spam-protection.ts tests/unit/spam-protection.test.ts
git commit -m "feat(about): add spam-protection utility with rate limiting and sanitization"
```

---

## Task 2: Wire Spam Protection into `contact.ts`

**Files:**
- Modify: `src/actions/contact.ts`
- Modify: `tests/unit/action-contact.test.ts`

**Interfaces:**
- Consumes: `getClientIP`, `checkRateLimit`, `sanitizeInput` from `@/utils/spam-protection`

- [ ] **Step 1: Write new failing test cases**

Add to `tests/unit/action-contact.test.ts` (append inside the `describe` block):

```typescript
  it('silently succeeds when honeypot field is filled', async () => {
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'Bot')
    formData.set('email', 'bot@example.com')
    formData.set('message', 'This is spam with more than ten characters')
    formData.set('gdprConsent', 'on')
    formData.set('website', 'http://spam.com') // honeypot filled
    formData.set('timestamp', String(Date.now() - 10_000))
    formData.set('recaptchaToken', 'valid-token')
    const result = await submitContact({ success: false }, formData)
    expect(result.success).toBe(true) // silent success to confuse bots
  })

  it('blocks submission with more than 3 links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.9 }),
    }))
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'Alice')
    formData.set('email', 'alice@gmail.com')
    formData.set('message', 'Check http://a.com http://b.com http://c.com http://d.com for deals!')
    formData.set('gdprConsent', 'on')
    formData.set('timestamp', String(Date.now() - 10_000))
    formData.set('recaptchaToken', 'valid-token')
    const result = await submitContact({ success: false }, formData)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/submission|processed|try again/i)
  })

  it('returns error when rate limit exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.9 }),
    }))
    const { submitContact } = await import('@/actions/contact')
    const makeSubmission = async () => {
      const formData = new FormData()
      formData.set('name', 'Alice')
      formData.set('email', 'alice@gmail.com')
      formData.set('message', 'Hello from Reach Radio fan, this is a nice message!')
      formData.set('gdprConsent', 'on')
      formData.set('timestamp', String(Date.now() - 10_000))
      formData.set('recaptchaToken', 'valid-token')
      return submitContact({ success: false }, formData)
    }
    // First 3 succeed (or hit Formspree mock); 4th is rate-limited
    await makeSubmission()
    await makeSubmission()
    await makeSubmission()
    const result = await makeSubmission()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/too many|try again/i)
  })
```

- [ ] **Step 2: Run tests to confirm new cases fail**

```bash
npx vitest run tests/unit/action-contact.test.ts
```

Expected: 2 new tests FAIL (link count and rate limit cases reference code not yet wired).

- [ ] **Step 3: Update `src/actions/contact.ts`**

Replace the full file with the following. Changes from current:
- Import `getClientIP`, `checkRateLimit`, `sanitizeInput` from `@/utils/spam-protection`
- Add rate limit check after honeypot/timing, before reCAPTCHA
- Add inline link-count check (>3 URLs) after reCAPTCHA
- Sanitize `name`, `email`, `message` before forwarding to Formspree

```typescript
'use server'

import { headers } from 'next/headers'
import { getClientIP, checkRateLimit, sanitizeInput } from '@/utils/spam-protection'

export interface ContactState {
  success: boolean
  error?: string
}

const MIN_SUBMIT_MS = 3_000

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = formData.get('name')
  const email = formData.get('email')
  const message = formData.get('message')
  const gdprConsent = formData.get('gdprConsent')
  const recaptchaToken = formData.get('recaptchaToken')
  const timestamp = formData.get('timestamp')

  // Honeypot check — any value means a bot; silently succeed
  const honeypots = ['website', 'url', 'homepage', 'phone']
  for (const field of honeypots) {
    if (formData.get(field)) {
      return { success: true }
    }
  }

  // Timing check — bots submit instantly
  if (timestamp) {
    const elapsed = Date.now() - Number(timestamp)
    if (elapsed < MIN_SUBMIT_MS) {
      return { success: true }
    }
  }

  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return { success: false, error: 'Invalid form data.' }
  }

  if (name.length < 2 || name.length > 100) {
    return { success: false, error: 'Name must be 2–100 characters.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' }
  }

  if (message.length < 10 || message.length > 2000) {
    return { success: false, error: 'Message must be 10–2000 characters.' }
  }

  if (!gdprConsent) {
    return { success: false, error: 'Please accept the consent checkbox.' }
  }

  if (!process.env.FORMSPREE_ENDPOINT) {
    return { success: false, error: 'Server configuration error.' }
  }

  const dryRun = formData.get('dryRun') === '1'
  const headersList = await headers()

  // Rate limiting — best-effort (resets on cold start)
  const clientIP = getClientIP(headersList)
  if (!checkRateLimit(clientIP)) {
    return { success: false, error: 'Too many submissions. Please try again later.' }
  }

  const isMobileApp =
    headersList.get('mobile-app') === 'true' ||
    headersList.get('cookie')?.includes('mobile-app=true')

  if (!isMobileApp && process.env.RECAPTCHA_SECRET_KEY) {
    if (!recaptchaToken || typeof recaptchaToken !== 'string') {
      return { success: false, error: 'reCAPTCHA verification required.' }
    }

    try {
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        }),
      })
      const verifyData = await verifyRes.json() as { success: boolean; score?: number }

      const threshold = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD ?? '0.5')
      if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < threshold)) {
        return { success: false, error: 'reCAPTCHA verification failed. Please try again.' }
      }
    } catch {
      return { success: false, error: 'Service unavailable. Please try again later.' }
    }
  }

  // Reject messages with 4+ URLs — strong spam signal, rare in legitimate messages
  const linkCount = (message.match(/https?:\/\/[^\s]+/g) ?? []).length
  if (linkCount > 3) {
    return { success: false, error: 'Your submission could not be processed. Please try again.' }
  }

  // Sanitize before forwarding
  const safeName = sanitizeInput(name, 100)
  const safeEmail = sanitizeInput(email, 254)
  const safeMessage = sanitizeInput(message, 2000)

  if (!dryRun) {
    try {
      const formspreeRes = await fetch(process.env.FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: safeName,
          email: safeEmail,
          message: safeMessage,
          gdprConsent: true,
          _subject: 'New Contact Form Submission - Reach Radio',
        }),
      })

      if (!formspreeRes.ok) {
        return { success: false, error: 'Failed to send message. Please try again.' }
      }
    } catch {
      return { success: false, error: 'Service unavailable. Please try again later.' }
    }
  }

  return { success: true }
}
```

- [ ] **Step 4: Run all contact-related tests**

```bash
npx vitest run tests/unit/action-contact.test.ts tests/unit/spam-protection.test.ts
```

Expected: All tests PASS.

**Note on the rate limit test:** The rate limit test uses `unknown` as the IP (from mocked headers returning `null`). All three initial calls register against `unknown`, then the 4th call hits the limit. Correct behavior — verifies the limit works end-to-end through the action.

- [ ] **Step 5: Run full unit test suite**

```bash
npx vitest run tests/unit/
```

Expected: Same pass/fail baseline as before this task. No regressions.

- [ ] **Step 6: Commit**

```bash
git add src/actions/contact.ts tests/unit/action-contact.test.ts
git commit -m "feat(about): wire rate limiting, link-count check, and sanitization into contact action"
```

---

## What Was Removed and Why

| Removed | Reason |
|---|---|
| `SPAM_KEYWORDS` list | Keyword lists stop naive bots only. reCAPTCHA already blocks them. Real spammers write around keywords. |
| `BOT_UA_PATTERNS` list | Any bot worth worrying about sends `Mozilla/5.0`. Catches only misconfigured bots reCAPTCHA already catches. |
| `DISPOSABLE_EMAIL_DOMAINS` list | 15 hardcoded domains vs. thousands in the wild. False sense of coverage. |
| `detectSpam()` scoring function | The only signal with real correlation (link count) is inlined directly — no need for a scoring system. |
| Suspicious email/name prefix checks | Too narrow. Caught by reCAPTCHA already. |
| Word repetition + ALL CAPS checks | Low signal. Legitimate excited messages trip these. |
| Geographic blocking | High false positive. Radio listeners are global. |
