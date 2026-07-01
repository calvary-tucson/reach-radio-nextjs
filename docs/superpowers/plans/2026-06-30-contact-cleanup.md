# Contact Form Code Quality Follow-up Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two code quality issues in `spam-protection.ts` plus two coverage gaps: (1) remove a redundant filter and a false-positive regex from `spam-protection.ts`, (2) add a missing test for the reCAPTCHA dev-skip path and create `.env.example`, and (3) fix pre-existing test failures caused by `ContactForm.tsx` using `useSearchParams()` without a `next/navigation` mock.

**Architecture:** All fixes are surgical — no new files, no new abstractions, no behavior changes (Task 1 is pure cleanup). Task 3 adds a missing `vi.mock` to an existing test file; the component is not changed.

**Tech Stack:** TypeScript strict, vitest, React Testing Library.

## Global Constraints

- TypeScript strict mode — no `any` in exported signatures
- No new npm dependencies
- All commits must use `fix(about):` scope per AGENTS.md
- Do NOT change the external behavior of `submitContact` or `sanitizeInput` — these are cleanups only
- Do NOT modify `src/components/about/ContactForm.tsx` — it has uncommitted work in progress; fix the test instead

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/spam-protection.ts` | Modify | Remove redundant filter in `checkRateLimit`; remove `on\w+=` pattern from `sanitizeInput` |
| `tests/unit/spam-protection.test.ts` | Modify | Remove test case for `on\w+=` (behavior being removed) |
| `tests/unit/action-contact.test.ts` | Modify | Add test for dev reCAPTCHA skip path |
| `.env.example` | Create | Document all contact-form env vars including `RECAPTCHA_SCORE_THRESHOLD` |
| `tests/unit/contact-form-on-success.test.tsx` | Modify | Add `vi.mock('next/navigation')` to fix pre-existing failures |

---

## Task 1: Clean up `spam-protection.ts` and `contact.ts`

**Files:**
- Modify: `src/utils/spam-protection.ts`
- Modify: `tests/unit/spam-protection.test.ts`

**Interfaces:**
- `sanitizeInput` signature unchanged: `(input: string, maxLength?: number) => string`
- `checkRateLimit` signature unchanged: `(ip: string) => boolean`
- No interface changes — purely internal cleanup

**What changes and why:**

1. `checkRateLimit` — the cleanup loop (lines 21–25) already prunes expired entries for every IP including the current one. The subsequent `.filter(t => t > windowStart)` on line 28 re-filters already-pruned timestamps — redundant.

2. `sanitizeInput` — the `/on\w+=/gi` replace (line 41) causes false positives: `song=`, `belong=`, `strong=`, `wrong=`, `among=` all get mangled. There is no XSS risk since the sanitized value goes to Formspree as an email body, never rendered as HTML. Remove it.

- [ ] **Step 1: Confirm tests pass before touching anything**

```bash
npx vitest run tests/unit/spam-protection.test.ts tests/unit/action-contact.test.ts
```

Expected: all tests pass (baseline).

- [ ] **Step 2: Update `src/utils/spam-protection.ts`**

Replace the full file with:

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

  // Cleanup loop above already pruned all entries; get() returns current-window timestamps only.
  const recent = submissionHistory.get(ip) ?? []

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
    .replace(/data:/gi, '')
    .substring(0, maxLength)
}
```

- [ ] **Step 3: Remove the `on\w+=` test case from `tests/unit/spam-protection.test.ts`**

Remove these 3 lines from the `describe('sanitizeInput')` block:

```typescript
  it('removes inline event handlers', () => {
    expect(sanitizeInput('onclick=evil()')).toBe('evil()')
  })
```

After removal the `sanitizeInput` describe block has 6 test cases (was 7).

- [ ] **Step 4: Run spam-protection tests to confirm they still pass**

```bash
npx vitest run tests/unit/spam-protection.test.ts
```

Expected: 14/14 passing (was 15/15; one test removed intentionally).

- [ ] **Step 5: Run all spam-protection and contact-action tests**

```bash
npx vitest run tests/unit/spam-protection.test.ts tests/unit/action-contact.test.ts
```

Expected: 14 spam-protection + 5 action-contact = 19 total passing.

- [ ] **Step 6: Commit**

```bash
git add src/utils/spam-protection.ts tests/unit/spam-protection.test.ts
git commit -m "fix(about): remove redundant rate-limit filter and false-positive event-handler regex"
```

---

## Task 2: Add reCAPTCHA skip test and create `.env.example`

**Files:**
- Modify: `tests/unit/action-contact.test.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: `submitContact` from `@/actions/contact` (unchanged from Task 1)

**Context:** The fix from the spam-protection PR added a three-way reCAPTCHA guard: key set → verify, key unset + production → fail-closed, key unset + non-production → skip. The skip path has no test. This task adds it.

- [ ] **Step 1: Write the failing test**

Add this test case inside the `describe('submitContact Server Action')` block at the bottom of `tests/unit/action-contact.test.ts` (after the existing rate-limit test):

```typescript
  it('skips reCAPTCHA when key is unset in non-production', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY
    const { submitContact } = await import('@/actions/contact')
    const formData = new FormData()
    formData.set('name', 'Alice')
    formData.set('email', 'alice@gmail.com')
    formData.set('message', 'Hello from Reach Radio fan, this is a nice message!')
    formData.set('gdprConsent', 'on')
    formData.set('timestamp', String(Date.now() - 10_000))
    formData.set('dryRun', '1')
    const result = await submitContact({ success: false }, formData)
    // If reCAPTCHA were NOT skipped, it would return error 'reCAPTCHA verification required.'
    // because no recaptchaToken is set. success=true proves the skip path fired.
    expect(result.success).toBe(true)
  })
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run tests/unit/action-contact.test.ts
```

Expected: **PASS**. The guard logic already exists in `contact.ts:72–102` from commit `ae3b9bf` — this test adds coverage for existing behavior; no code changes needed.

If it FAILS: the guard is broken. Investigate `contact.ts` lines 72–102 (the three-way reCAPTCHA block) before proceeding.

- [ ] **Step 3: Run full action test suite**

```bash
npx vitest run tests/unit/action-contact.test.ts
```

Expected: all 6 tests pass (5 original + 1 new).

- [ ] **Step 4: Create `.env.example`**

Create the file at project root:

```bash
# Contact Form — Formspree
# Required. Get from https://formspree.io/
FORMSPREE_ENDPOINT=https://formspree.io/f/YOUR_FORM_ID

# Contact Form — Google reCAPTCHA v3
# Required in production. Get from https://www.google.com/recaptcha/admin
# Omitting this in a non-production environment skips reCAPTCHA verification.
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key

# reCAPTCHA score threshold (0.0–1.0, default 0.5)
# Submissions scoring below this value are rejected as likely bot traffic.
RECAPTCHA_SCORE_THRESHOLD=0.5

# Client-side reCAPTCHA site key (public — safe to expose)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/action-contact.test.ts .env.example
git commit -m "fix(about): add reCAPTCHA skip test and document env vars in .env.example"
```

---

## Task 3: Fix pre-existing `contact-form-on-success` test failures

**Files:**
- Modify: `tests/unit/contact-form-on-success.test.tsx`

**Interfaces:**
- Does NOT modify `src/components/about/ContactForm.tsx` — the component has uncommitted in-progress work; the fix belongs in the test

**Root cause:** `ContactForm.tsx` (uncommitted changes) calls `useSearchParams()` from `next/navigation`. In the test environment without a Suspense boundary, Next.js returns `null` from this hook. The test then calls `.has('contact-dry-run')` on null → `TypeError: Cannot read properties of null (reading 'has')`.

**Fix:** Add `vi.mock('next/navigation')` returning a real `URLSearchParams()` object. This is already the correct pattern — the test mocks `react`, `sonner`, and `@/actions/contact`; `next/navigation` was simply missing.

**Follow-up (out of scope for this plan):** When the uncommitted `ContactForm.tsx` changes ship, verify that every call site (`ContactSheet.tsx`, `/about/page.tsx`) wraps `<ContactForm>` in a `<Suspense>` boundary — `useSearchParams()` throws at runtime without one.

- [ ] **Step 1: Confirm the tests fail before touching anything**

```bash
npx vitest run tests/unit/contact-form-on-success.test.tsx
```

Expected: 3/3 FAIL with `TypeError: Cannot read properties of null (reading 'has')`.

If they PASS, stop — the issue may be resolved already (e.g., ContactForm.tsx working tree changes were reverted). Do not add an unnecessary mock.

- [ ] **Step 2: Add the `next/navigation` mock**

In `tests/unit/contact-form-on-success.test.tsx`, add this line immediately after the existing `vi.mock('sonner', ...)` line (before the `@/actions/contact` mock):

```typescript
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))
```

The top of the file should now read:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { ContactState } from '@/actions/contact'

// Mock useActionState before importing ContactForm
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useActionState: vi.fn() }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/actions/contact', () => ({
  submitContact: vi.fn(),
}))
```

- [ ] **Step 3: Run the tests to confirm they pass**

```bash
npx vitest run tests/unit/contact-form-on-success.test.tsx
```

Expected: 3/3 PASS.

- [ ] **Step 4: Run full unit suite**

```bash
npx vitest run tests/unit/
```

Expected: 311/311 passing (3 previously-failing tests now passing, no regressions).

- [ ] **Step 5: Commit**

```bash
git add tests/unit/contact-form-on-success.test.tsx
git commit -m "fix(about): mock next/navigation in ContactForm test to fix useSearchParams null error"
```
