# WCAG Contrast Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every text and icon color in the app meets WCAG 2.2 AA (4.5:1 text, 3:1 icons) in light and dark, and a test stops regressions.

**Architecture:** Class-only edits (no layout, size, or markup change) driven by the audit at `docs/accessibility-contrast-audit-2026-11-01.md` (finding IDs T1-xx, T2-xx, T3-xx below). A vitest guard test scans `src/` for banned low-contrast classes. A Playwright test measures real rendered contrast on key pages in both themes.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching routes; this plan touches classes only), Tailwind 4.2.4 with custom `light:` variant, vitest 4, Playwright.

## Global Constraints

- Contrast only. No size, layout, copy, or markup changes. 10px compact time stays 10px (a size bump needs the owner's separate OK).
- Light replacements: text on any surface becomes `gray-600` or darker; icons become `gray-500` or darker; brand green text on light becomes `light:text-green-700`. Never `gray-500` text on `gray-100`/`gray-200`.
- Dark replacements: text minimum `white/60`; icons minimum `white/50`. Nothing below `white/50`.
- Keep every existing `cursor-pointer`, `focus-visible:*`, `motion-safe:` class untouched.
- Commit scopes (AGENTS.md): `schedule`, `teachers`, `layout`, `player`, `global`, `about`, `seo`, `test`. A11y fixes use the component's scope, never `a11y`.
- Do NOT push. Local commits only. Do NOT edit `AGENTS.md` (Tier 4 rule change is an owner decision).
- Git rules for committers: `git add <paths>` and `git commit -m "..." -- <paths>`, never amend or reset, edit with Edit/Write tools.
- UI-mock gate: skipped. This is a contrast-only token swap, same layout; before/after screenshots in Task 6 are the visual check.
- Tests run through Doppler where needed: owner runs `! cd <worktree> && doppler run -- npm run test:e2e` if the sandbox blocks it.

## File Structure

| Task | Files (allowed edit list) |
|---|---|
| 1 | Create `tests/unit/contrast-classes.test.ts` |
| 2 | `src/components/teachers/ScheduleCardList.tsx`, `ScheduleWeekCards.tsx`, `ScheduleTabView.tsx` |
| 3 | `src/components/teachers/TeachersClientView.tsx`, `TeacherSortControl.tsx`, `TeacherSearchClient.tsx`, `TeacherSearchBar.tsx`, `RecommendedTeachers.tsx`, `primitives/TeacherInfoChip.tsx` |
| 4 | `src/components/global/Pagination.tsx`, `Breadcrumbs.tsx`, `PassiveSearchBar.tsx`, `src/app/about/page.tsx`, `src/app/teachers/error.tsx`, `src/app/teachers/search/error.tsx`, `src/app/teachers/[slug]/error.tsx` |
| 5 | `src/components/layout/Footer.tsx`, `src/components/media-bar/NowPlayingInfo.tsx`, `src/components/media-bar/SleepTimerIndicator.tsx`, `src/app/teachers/[slug]/opengraph-image.tsx`, `src/app/opengraph-image.tsx` |
| 6 | Create `tests/e2e/contrast.spec.ts` |
| 7 | none (verification, report status update in the audit doc) |

Tasks 2 to 5 are independent after Task 1 (disjoint files) and can run in parallel. All paths are relative to the repo root. If a task needs a file not listed, stop and report back.

---

### Task 1: Regression guard test (write first, fails until Tasks 2 to 5 land)

**Files:**
- Create: `tests/unit/contrast-classes.test.ts`

**Interfaces:**
- Produces: a vitest suite that fails on any banned class in `src/`. Tasks 2 to 5 use it as their failing/passing check.

- [ ] **Step 1: Write the test**

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', 'src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts|css)$/.test(name) ? [p] : []
  })
}

interface Rule {
  name: string
  /** Matches a banned class on a line. */
  pattern: RegExp
  /** Optional: line is OK if this also matches (e.g. a light variant is present). */
  unless?: RegExp
}

const RULES: Rule[] = [
  // Light theme: below 4.5:1 for any text, below 3:1 for icons.
  { name: 'light gray-100..400 text', pattern: /light:(?:hover:|placeholder:)?text-gray-(?:100|200|300|400)\b/ },
  // Light theme: green-600 text is 3.52:1.
  { name: 'light green-600 text', pattern: /light:text-green-600\b/ },
  // Dark theme: white alpha 10..40 is under 4:1 even for icons on some surfaces.
  { name: 'dark white/10..40 text', pattern: /(?<![\w-])(?:placeholder:)?text-white\/(?:10|15|20|25|30|35|40)\b/ },
  // Brand green text without a light variant is 2.1 to 2.35:1 on light.
  { name: 'brand green text without light variant', pattern: /(?<![\w-])text-\[#84b84f\]/, unless: /light:text-green-(?:700|800)\b/ },
]

describe('contrast class guard', () => {
  const files = walk(ROOT)

  for (const rule of RULES) {
    it(`no ${rule.name}`, () => {
      const hits: string[] = []
      for (const file of files) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (rule.pattern.test(line) && !(rule.unless && rule.unless.test(line))) {
            hits.push(`${file.replace(ROOT, 'src')}:${i + 1}`)
          }
        })
      }
      expect(hits, hits.join('\n')).toEqual([])
    })
  }
})
```

Known limit: a multi-line `className` where the green and its `light:` variant sit on different lines would be a false positive; fix by putting them on one line, not by loosening the rule.

- [ ] **Step 2: Run it, confirm it fails with the audit's file list**

Run: `npx vitest run tests/unit/contrast-classes.test.ts`
Expected: FAIL, all four rules list hits matching audit IDs (about 40 hits across the four rules: 18 + 1 + 14 + 7, some lines overlap).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/contrast-classes.test.ts
git commit -m "test: guard against low-contrast text classes" -- tests/unit/contrast-classes.test.ts
```

(A red test in one commit is intentional; the next tasks turn it green. If the owner wants a green history, squash Task 1 into the final task's commit.)

---

### Task 2: Schedule components

**Files:**
- Modify: `src/components/teachers/ScheduleCardList.tsx` (lines 20, 41, 42, 80, 87, 88)
- Modify: `src/components/teachers/ScheduleWeekCards.tsx` (lines 38, 39)
- Modify: `src/components/teachers/ScheduleTabView.tsx` (lines 101, 116, 138, 143)

Findings: T1-01 to T1-12, T2-05.

- [ ] **Step 1: Edit `ScheduleCardList.tsx`**

Line 20: `text-white/50 light:text-gray-400` -> `text-white/70 light:text-gray-600`
Line 41: `text-white/25 light:text-gray-400` -> `text-white/70 light:text-gray-600`
Line 42: `text-white/20 light:text-gray-300` -> `text-white/60 light:text-gray-600`
Line 80: `'text-[#84b84f]'` (active branch) -> `'text-[#84b84f] light:text-green-700'`; non-active `'text-white/55 light:text-gray-500'` -> `'text-white/60 light:text-gray-600'`
Line 87: `'text-[#84b84f] bg-[rgba(132,184,79,0.15)]'` -> `'text-[#84b84f] light:text-green-700 bg-[rgba(132,184,79,0.15)]'`
Line 88: `'text-white/30 light:text-gray-400 bg-white/[0.06] light:bg-gray-100'` -> `'text-white/60 light:text-gray-600 bg-white/[0.06] light:bg-gray-100'`

- [ ] **Step 2: Edit `ScheduleWeekCards.tsx`**

Line 38: `'text-[#84b84f] border-[rgba(132,184,79,0.25)]'` -> `'text-[#84b84f] light:text-green-700 border-[rgba(132,184,79,0.25)]'`
Line 39: `'text-white/40 light:text-gray-400 border-...'` -> `'text-white/60 light:text-gray-600 border-...'` (keep the border classes)

- [ ] **Step 3: Edit `ScheduleTabView.tsx`**

Line 101: `text-white/50 light:text-gray-400` -> `text-white/60 light:text-gray-500` (icon)
Line 116: `text-white/40 light:text-gray-400` -> `text-white/60 light:text-gray-600`
Line 138: `text-[#84b84f]` on the check icon -> `text-[#84b84f] light:text-green-700`
Line 143: `text-[#84b84f] text-xs` -> `text-[#84b84f] light:text-green-700 text-xs`

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/unit/contrast-classes.test.ts`
Expected: no hits remain in these three files (other files still listed).
Run: `npx tsc --noEmit && npx eslint src/components/teachers/ScheduleCardList.tsx src/components/teachers/ScheduleWeekCards.tsx src/components/teachers/ScheduleTabView.tsx`
Expected: clean.
Run: `npx vitest run` (full unit suite). Expected: any pre-existing schedule tests pass (they assert on `data-testid`, not on color classes; if one asserts a class string, update that assertion).

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/ScheduleCardList.tsx src/components/teachers/ScheduleWeekCards.tsx src/components/teachers/ScheduleTabView.tsx
git commit -m "fix(schedule): raise text contrast to meet WCAG AA" -- src/components/teachers/ScheduleCardList.tsx src/components/teachers/ScheduleWeekCards.tsx src/components/teachers/ScheduleTabView.tsx
```

---

### Task 3: Teachers list, search, tabs, chips

**Files:** `TeachersClientView.tsx`, `TeacherSortControl.tsx`, `TeacherSearchClient.tsx`, `TeacherSearchBar.tsx`, `RecommendedTeachers.tsx`, `primitives/TeacherInfoChip.tsx` (all under `src/components/teachers/`).

Findings: T1-13 to T1-19, T1-21 to T1-24, T2-04.

- [ ] **Step 1: Edit**

`TeachersClientView.tsx:43`: `light:text-green-600 border-[#84b84f] light:border-green-600` -> `light:text-green-700 border-[#84b84f] light:border-green-600` (border keeps 600, it is a 3:1 non-text edge: 3.52 passes).
`TeachersClientView.tsx:58`: `text-white/50 light:text-gray-400` -> `text-white/60 light:text-gray-600`
`TeachersClientView.tsx:61`: `text-white/50 light:text-gray-400` -> `text-white/70 light:text-gray-600`
`TeacherSortControl.tsx:48`: `light:text-gray-400` -> `light:text-gray-600`
`TeacherSearchClient.tsx:65` (`chipActive`): `text-[#84b84f]` -> `text-[#84b84f] light:text-green-700`
`TeacherSearchClient.tsx:135`: `text-white/20` -> `text-white/50 light:text-gray-500`
`TeacherSearchClient.tsx:141`: `light:text-gray-400` -> `light:text-gray-600`
`TeacherSearchBar.tsx:59`: `text-white/40 light:text-gray-400` -> `text-white/50 light:text-gray-500`
`TeacherSearchBar.tsx:75`: `placeholder:text-white/40 light:placeholder:text-gray-400` -> `placeholder:text-white/60 light:placeholder:text-gray-500`
`TeacherSearchBar.tsx:83`: `text-white/60 light:text-gray-400` -> `text-white/60 light:text-gray-500`
`RecommendedTeachers.tsx:52`: `text-white/50 light:text-gray-400` -> `text-white/60 light:text-gray-500`
`TeacherInfoChip.tsx:12` (`dim`): `text-white/50 light:text-gray-500` -> `text-white/60 light:text-gray-600`; update the doc comment on line 8 from `white/50 text` to `white/60 text`.

- [ ] **Step 2: Verify**

Run: `npx vitest run tests/unit/contrast-classes.test.ts` (no hits left in these files), `npx tsc --noEmit`, `npx eslint` on the six files, `npx vitest run`.
Expected: clean; existing teacher tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeachersClientView.tsx src/components/teachers/TeacherSortControl.tsx src/components/teachers/TeacherSearchClient.tsx src/components/teachers/TeacherSearchBar.tsx src/components/teachers/RecommendedTeachers.tsx src/components/teachers/primitives/TeacherInfoChip.tsx
git commit -m "fix(teachers): raise text and icon contrast to meet WCAG AA" -- src/components/teachers/TeachersClientView.tsx src/components/teachers/TeacherSortControl.tsx src/components/teachers/TeacherSearchClient.tsx src/components/teachers/TeacherSearchBar.tsx src/components/teachers/RecommendedTeachers.tsx src/components/teachers/primitives/TeacherInfoChip.tsx
```

---

### Task 4: Global components, about, error pages

**Files:** `src/components/global/Pagination.tsx`, `Breadcrumbs.tsx`, `PassiveSearchBar.tsx`; `src/app/about/page.tsx`; `src/app/teachers/error.tsx`, `src/app/teachers/search/error.tsx`, `src/app/teachers/[slug]/error.tsx`.

Findings: T1-20, T1-25 to T1-31.

- [ ] **Step 1: Edit**

`Pagination.tsx:43`: `text-white/60 light:text-gray-400` -> `text-white/60 light:text-gray-600`
`Breadcrumbs.tsx:63`: `text-white/60 light:text-gray-400` -> `text-white/60 light:text-gray-500`
`PassiveSearchBar.tsx:91`: `text-white/40 light:text-gray-500` -> `text-white/50 light:text-gray-500` (icon)
`PassiveSearchBar.tsx:97`: `text-white/40 light:text-gray-500` -> `text-white/60 light:text-gray-600`
`about/page.tsx:203`: `text-white/40 light:text-gray-400 group-hover:text-white/70` -> `text-white/50 light:text-gray-500 group-hover:text-white/70`
`teachers/error.tsx:8`, `teachers/search/error.tsx:8`, `teachers/[slug]/error.tsx:8`: `text-white/40 light:text-gray-500` -> `text-white/60 light:text-gray-600`

- [ ] **Step 2: Verify**

Run: `npx vitest run tests/unit/contrast-classes.test.ts`, `npx tsc --noEmit`, `npx eslint` on the seven files, `npx vitest run`.
Expected: clean. Guard test now fully green except Task 5 files (Footer etc. have no guard rule hits; guard should be fully green after Tasks 2 to 4).

- [ ] **Step 3: Commit (two commits, two scopes)**

```bash
git add src/components/global/Pagination.tsx src/components/global/Breadcrumbs.tsx src/components/global/PassiveSearchBar.tsx
git commit -m "fix(global): raise text and icon contrast to meet WCAG AA" -- src/components/global/Pagination.tsx src/components/global/Breadcrumbs.tsx src/components/global/PassiveSearchBar.tsx
git add src/app/about/page.tsx src/app/teachers/error.tsx src/app/teachers/search/error.tsx "src/app/teachers/[slug]/error.tsx"
git commit -m "fix(teachers): raise error digest and chevron contrast to meet WCAG AA" -- src/app/about/page.tsx src/app/teachers/error.tsx src/app/teachers/search/error.tsx "src/app/teachers/[slug]/error.tsx"
```

---

### Task 5: Footer, media bar, sleep timer icon, OG images

**Files:** `src/components/layout/Footer.tsx`, `src/components/media-bar/NowPlayingInfo.tsx`, `src/components/media-bar/SleepTimerIndicator.tsx`, `src/app/teachers/[slug]/opengraph-image.tsx`, `src/app/opengraph-image.tsx`.

Findings: T2-01 to T2-03, T3-01, T3-02.

- [ ] **Step 1: Edit**

`Footer.tsx:9` and `:30`: `light:text-gray-500` -> `light:text-gray-600` (keep the dark `text-gray-400` / `text-gray-300`, they pass at 5.24 / 9.26)
`NowPlayingInfo.tsx:34`: `text-white/70 light:text-gray-500` -> `text-white/70 light:text-gray-600`
`SleepTimerIndicator.tsx:28`: `text-white light:text-gray-900` -> `text-gray-900`
`teachers/[slug]/opengraph-image.tsx:98`: `rgba(255,255,255,0.45)` -> `rgba(255,255,255,0.7)`
`opengraph-image.tsx:47`: `rgba(255,255,255,0.6)` -> `rgba(255,255,255,0.8)`

- [ ] **Step 2: Check the existing tests that touch these**

Run: `grep -rn "SleepTimerIndicator\|NowPlayingInfo\|Footer" tests/unit | head` then `npx vitest run tests/unit/media-bar.test.tsx tests/unit/bridge-sleep-timer.test.tsx`
Expected: pass. If a test asserts the old icon class string, update that assertion to the new class.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`, `npx eslint` on the five files, `npx vitest run`.

```bash
git add src/components/layout/Footer.tsx
git commit -m "fix(layout): raise footer text contrast on gray-100 to meet WCAG AA" -- src/components/layout/Footer.tsx
git add src/components/media-bar/NowPlayingInfo.tsx src/components/media-bar/SleepTimerIndicator.tsx
git commit -m "fix(player): raise artist text and sleep timer icon contrast to meet WCAG AA" -- src/components/media-bar/NowPlayingInfo.tsx src/components/media-bar/SleepTimerIndicator.tsx
git add src/app/teachers/[slug]/opengraph-image.tsx src/app/opengraph-image.tsx
git commit -m "fix(seo): raise share-card text contrast" -- "src/app/teachers/[slug]/opengraph-image.tsx" src/app/opengraph-image.tsx
```

---

### Task 6: In-browser contrast measurement (catches what class grep cannot)

**Files:**
- Create: `tests/e2e/contrast.spec.ts`

**Interfaces:**
- Consumes: existing Playwright config and the `?theme=light|dark` param (precedence: param, cookie, default; works on web and app).
- Produces: e2e test `contrast` that fails on any visible text node under 4.5:1 (3:1 for text at 24px, or 18.66px bold) on the listed pages in both themes.

- [ ] **Step 1: Write the spec**

Pages: `/`, `/teachers`, `/teachers?tab=schedule` (open the Schedule tab by clicking `role=tab[name=Schedule]` if the param is not supported), `/about`, `/donate`. Also open the day-picker modal and a teacher modal from the schedule tab and measure again while open.

The in-page measurer walks visible text nodes, takes the computed `color` (resolving alpha by blending against the first ancestor with an opaque background, compositing translucent backgrounds on the way) and the effective background, then computes the WCAG ratio. Core function:

```ts
import { expect, test, type Page } from '@playwright/test'

const MEASURE = () => {
  const parse = (s: string): [number, number, number, number] => {
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (!m) return [0, 0, 0, 0]
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  const over = (fg: number[], bg: number[]) => {
    const a = fg[3]
    return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))).concat(1)
  }
  const lum = ([r, g, b]: number[]) => {
    const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const bgOf = (el: Element): number[] => {
    const layers: number[][] = []
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] === 1) break
    }
    return layers.reverse().reduce((acc, l) => over(l, acc), [255, 255, 255, 1])
  }
  const out: { text: string; ratio: number; need: number; selector: string }[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = (t.textContent ?? '').trim()
    const el = t.parentElement
    if (!text || !el) continue
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0 || r.width === 0 || r.height === 0) continue
    const bg = bgOf(el)
    const fg = over(parse(cs.color), bg)
    const l1 = lum(fg), l2 = lum(bg)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    const px = parseFloat(cs.fontSize)
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    if (ratio < need) out.push({ text: text.slice(0, 40), ratio: Math.round(ratio * 100) / 100, need, selector: el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 3).join('.') })
  }
  return out
}

const PAGES = ['/', '/teachers', '/about', '/donate']

for (const theme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`contrast ${theme} ${path}`, async ({ page }) => {
      await page.goto(`${path}${path.includes('?') ? '&' : '?'}theme=${theme}`)
      await page.waitForLoadState('networkidle')
      const fails = await page.evaluate(MEASURE)
      expect(fails, JSON.stringify(fails, null, 2)).toEqual([])
    })
  }

  test(`contrast ${theme} schedule tab and day picker`, async ({ page }) => {
    await page.goto(`/teachers?theme=${theme}`)
    await page.getByRole('tab', { name: /schedule/i }).click()
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(MEASURE), 'schedule tab').toEqual([])
    const picker = page.getByRole('button', { name: /day|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i }).first()
    if (await picker.isVisible()) {
      await picker.click()
      expect(await page.evaluate(MEASURE), 'day picker open').toEqual([])
    }
  })
}
```

Notes for the implementer: the day-picker trigger selector is a best guess; open `src/components/teachers/ScheduleTabView.tsx` and use its real button name or `data-testid`. Reuse the existing helper style in `tests/e2e/theme-default.spec.ts` for emulating color scheme if `?theme=` handling differs there. Elements covered by a photo or gradient (avatars, hero art) have no solid background and will be measured against white; add an inline `data-contrast-skip` attribute on those if they show up as false positives, and list each skip in the report.

- [ ] **Step 2: Run against the fixed code**

Run (owner may need to run via Doppler): `npm run test:e2e -- tests/e2e/contrast.spec.ts`
Expected: PASS for all 10 tests. Any failure names a text, ratio, and selector. Fix the class (same Global Constraints) and rerun. A failure not in the audit is a new finding: add it to the audit doc.

- [ ] **Step 3: Prove the test catches the bug**

Temporarily revert `ScheduleCardList.tsx:42` to `light:text-gray-300` (do not commit), rerun the schedule light test. Expected: FAIL naming the music time with ratio near 1.41. Restore the fix.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/contrast.spec.ts
git commit -m "test: measure rendered text contrast in light and dark" -- tests/e2e/contrast.spec.ts
```

---

### Task 7: Final verification and handoff

- [ ] **Step 1: Full gate**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: all clean, full unit suite green (385+ tests plus the 4 new guard tests), build passes.

- [ ] **Step 2: Visual before/after**

With the dev server up (owner uses the dedicated dev session and `dev.calvarytucson.com`-style hostname; check processes first), take light and dark screenshots of: `/teachers` schedule tab including a music row, week view, the day picker open, the teacher modal, the media bar, and the footer. Review them end to end, fix anything off, then show the owner.

- [ ] **Step 3: Update the audit doc**

Add a "Status" line at the top of `docs/accessibility-contrast-audit-2026-11-01.md`: fixed on date, commit range, measured results from Task 6. Commit as `docs: mark contrast audit findings fixed`.

- [ ] **Step 4: Report to owner**

List commits (`git log origin/main..HEAD`), the Task 6 pass result, and ask for push permission. Raise the Tier 4 AGENTS.md rule wording as a separate yes/no.

## Self-Review

- Spec coverage: schedule (owner report), whole site (Tasks 2 to 5 cover all T1/T2/T3 IDs), modals and tabs (T1-09 to T1-13, T2-03, T3-01, Task 6 opens the day picker modal), report (audit doc), plan (this doc). T1-26 (Breadcrumbs separator) is decorative and listed as low priority; it is included for consistency.
- Placeholders: none. The day-picker selector in Task 6 is flagged as needing the real name from the source file.
- Consistency: guard-test rules match the replacement classes (no `white/10..40`, no `light:gray-100..400` text, no `light:green-600` text, brand green always paired with `light:text-green-700`). `light:text-gray-500` for icons is allowed by the guard on purpose (4.84 on white passes 3:1).
