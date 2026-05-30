# Site-Wide Design System Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align all non-teacher pages with the established design system derived from the teachers pages, ensuring consistent typography, color tokens, surface treatments, border radii, and accessibility patterns site-wide.

**Architecture:** Each page is updated in isolation — styling changes only, zero behavior changes. Legacy `gray-700`, `green-600`, and `rounded` classes are replaced with canonical design system values from `docs/design-system.md`. Design doc is corrected first so it is the authoritative spec for all subsequent tasks.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript strict mode.

---

## Files Modified

| File | Change |
|---|---|
| `docs/design-system.md` | Fix 3 spec inaccuracies from TeacherDetailContent audit |
| `src/app/sleep-timer/SleepTimerClient.tsx` | h1, timer button grid, cancel button |
| `src/app/scheduled-list/page.tsx` | h1, day headings, row surfaces |
| `src/app/donate/page.tsx` | h1, skeleton colors |
| `src/app/about/page.tsx` | Hero colors, card surfaces, headings, border radii |
| `src/app/page.tsx` | Container padding, section heading |
| `src/components/home/RadioPlayer.tsx` | Surface card treatment |
| `src/components/home/TodaySchedule.tsx` | Row surfaces |
| `src/app/about/privacy-policy/page.tsx` | Container padding |

---

## Task 1: Fix Design Doc Inaccuracies

**Files:**
- Modify: `docs/design-system.md`

Three spec errors found by auditing `src/components/teachers/TeacherDetailContent.tsx`:
1. Banner height: doc `h-[72px] md:h-[140px]` → actual `h-[100px] md:h-[180px]`
2. Avatar overlap: doc `mt-[-36px] md:mt-[-88px]` → actual `mt-[-88px]` (same both breakpoints)
3. CTA button: doc says mobile=ghost pill → actual uses solid green on mobile (`md:hidden`, same as desktop)

- [ ] **Step 1: Fix banner height in Detail Panel Content Layout section**

Find the line:
```
1. Decorative banner (`h-[72px] md:h-[140px]`, dark green gradient + stripe + radial glow)
```
Replace with:
```
1. Decorative banner (`h-[100px] md:h-[180px]`, dark green gradient + stripe + radial glow)
```

- [ ] **Step 2: Fix avatar overlap in Detail Panel Content Layout section**

Find the line:
```
2. Avatar overlapping banner (`mt-[-36px] md:mt-[-88px]`), beside primary CTA
```
Replace with:
```
2. Avatar overlapping banner (`mt-[-88px]` on both breakpoints), beside primary CTA
```

- [ ] **Step 3: Fix Primary CTA Button spec**

Find the section "Primary CTA Button (inside panel)". Replace the mobile ghost pill entry:

Old:
```
Mobile — ghost pill:
bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.3)] rounded-full px-3 py-[6px]
text-[10px] font-semibold text-[#84b84f] hover:bg-[rgba(132,184,79,0.18)] transition-colors cursor-pointer
```
New:
```
Mobile (detail page, `md:hidden`) — solid green with tighter padding than desktop:
bg-[#84b84f] rounded-full px-4 py-2 text-sm font-bold text-[#0a1305]
hover:bg-[#96cc5e] transition-colors cursor-pointer
```

- [ ] **Step 4: Commit**

```bash
git add docs/design-system.md
git commit -m "docs(design): fix 3 spec inaccuracies from TeacherDetailContent audit"
```

---

## Task 2: Sleep Timer Page

**Files:**
- Modify: `src/app/sleep-timer/SleepTimerClient.tsx`

Changes: h1 → design system scale, timer buttons → `bg-white/5 border border-white/10 rounded-xl`, cancel button → dark red with `rounded-full`.

- [ ] **Step 1: Replace SleepTimerClient.tsx content**

```tsx
'use client'

import { useMediaStore } from '@/lib/store/media-store'

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]

export default function SleepTimerPage() {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const remainingSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const startSleepTimer = useMediaStore((s) => s.startSleepTimer)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)

  function start(minutes: number) {
    startSleepTimer(minutes * 60)
  }

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  return (
    <div className="px-4 py-6 max-w-sm mx-auto text-center">
      <h1 className="text-[22px] font-extrabold text-white tracking-tight mb-6">Sleep Timer</h1>

      {active ? (
        <div>
          <p
            className="text-white text-4xl font-mono mb-4"
            aria-live="polite"
            aria-atomic="true"
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-white/60 text-sm mb-6">Radio stops in {minutes}m {seconds}s</p>
          <button
            onClick={cancel}
            className="bg-red-700/80 border border-red-500/40 text-white px-6 py-2 rounded-full font-semibold text-sm hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
          >
            Cancel Timer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {TIMER_OPTIONS.map((mins) => (
            <button
              key={mins}
              onClick={() => start(mins)}
              className="bg-white/5 border border-white/10 text-white py-4 rounded-xl font-medium text-sm hover:bg-white/10 hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
            >
              {mins}m
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/sleep-timer/SleepTimerClient.tsx
git commit -m "style(sleep-timer): align to design system — h1, button grid, cancel button"
```

---

## Task 3: Full Schedule Page

**Files:**
- Modify: `src/app/scheduled-list/page.tsx`

Changes: h1 → design system scale, day h2 → allcaps section label, row `<Link>` → `bg-white/5 border border-white/10 rounded-xl`.

- [ ] **Step 1: Update h1**

In `src/app/scheduled-list/page.tsx`, find:
```tsx
<h1 className="text-white text-2xl font-bold mb-6">Full Schedule</h1>
```
Replace with:
```tsx
<h1 className="text-[22px] md:text-4xl font-extrabold text-white tracking-tight mb-6">Full Schedule</h1>
```

- [ ] **Step 2: Update day heading and empty state**

Find:
```tsx
<h2 className="text-white font-semibold text-lg mb-3">{day}</h2>
```
Replace with:
```tsx
<h2 className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/55 mb-3">{day}</h2>
```

Find:
```tsx
<p className="text-white/60">No schedule available.</p>
```
Replace with:
```tsx
<p className="text-sm text-white/45 py-12">No schedule available.</p>
```

- [ ] **Step 3: Update row surfaces**

Find:
```tsx
className="flex items-center gap-3 p-3 bg-gray-700/30 rounded hover:bg-gray-700/50 transition-colors"
```
Replace with:
```tsx
className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-colors cursor-pointer"
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/scheduled-list/page.tsx
git commit -m "style(schedule): align to design system — h1, day headings, row surfaces"
```

---

## Task 4: Donate Page

**Files:**
- Modify: `src/app/donate/page.tsx`

Changes: h1 → design system scale, skeleton container → `bg-[#1c2128]`, skeleton blocks → `bg-white/5 rounded-xl`.

- [ ] **Step 1: Update h1**

Find:
```tsx
<h1 className="text-white text-2xl font-bold mb-4">Donate</h1>
```
Replace with:
```tsx
<h1 className="text-[22px] md:text-4xl font-extrabold text-white tracking-tight mb-6">Donate</h1>
```

- [ ] **Step 2: Update skeleton**

Find the skeleton `<div role="status" ...>` and replace:
```tsx
<div role="status" aria-label="Loading donation form..." className="animate-pulse flex flex-col gap-4 h-[900px] bg-black rounded p-4">
  <div className="h-[60px] bg-gray-700 rounded" />
  <div className="h-[1.2em] w-[90%] bg-gray-700 rounded" />
  <div className="h-[1.2em] w-[60%] bg-gray-700 rounded" />
  <div className="h-[150px] bg-gray-700 rounded" />
  <div className="h-[1.2em] w-[85%] bg-gray-700 rounded" />
  <div className="h-[1.2em] w-[75%] bg-gray-700 rounded" />
  <div className="h-[100px] bg-gray-700 rounded" />
</div>
```
With:
```tsx
<div role="status" aria-label="Loading donation form..." className="animate-pulse flex flex-col gap-4 h-[900px] bg-[#1c2128] border border-white/5 rounded-[18px] p-4">
  <div className="h-[60px] bg-white/5 rounded-xl" />
  <div className="h-[1.2em] w-[90%] bg-white/5 rounded-xl" />
  <div className="h-[1.2em] w-[60%] bg-white/5 rounded-xl" />
  <div className="h-[150px] bg-white/5 rounded-xl" />
  <div className="h-[1.2em] w-[85%] bg-white/5 rounded-xl" />
  <div className="h-[1.2em] w-[75%] bg-white/5 rounded-xl" />
  <div className="h-[100px] bg-white/5 rounded-xl" />
</div>
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/donate/page.tsx
git commit -m "style(donate): align h1 and skeleton to design system"
```

---

## Task 5: About Page

**Files:**
- Modify: `src/app/about/page.tsx`

This is the most complex task. Four sections:
1. **Frequency hero** — `from-green-600 to-green-700` → brand green `#84b84f`; right panel `gray-800/900` → `#1c2128`; `rounded` → `rounded-[18px]`
2. **App download section** — `bg-gray-700/40 rounded` → `bg-[#1c2128] border border-white/5 rounded-[18px]`
3. **Contact form section** — same as above
4. **Privacy policy link** — `bg-gray-700/40 rounded` → `bg-white/5 border border-white/10 rounded-xl`

Also: add `<h1 className="sr-only">About Reach Radio</h1>` for a11y (page currently has no h1).

The `<OrganizationSchema ... />` and all its props remain unchanged. The two SVG badge elements (App Store, Google Play) remain unchanged — only their wrapper `<a>` className changes.

- [ ] **Step 1: Update outer container**

Find:
```tsx
<div className="page-enter px-4 py-6 max-w-2xl mx-auto space-y-6">
```
Replace with:
```tsx
<div className="page-enter px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-6">
```

- [ ] **Step 2: Add sr-only h1 after `<OrganizationSchema ... />`**

After the closing `/>` of `<OrganizationSchema`, add:
```tsx
<h1 className="sr-only">About Reach Radio</h1>
```

- [ ] **Step 3: Update frequency hero**

Find the entire frequency hero comment block and replace:
```tsx
{/* Frequency hero */}
<div className="grid md:grid-cols-2 rounded overflow-hidden">
  <div className="text-center p-5 bg-gradient-to-b from-green-600 to-green-700 flex flex-col justify-center items-center">
    <div className="text-5xl text-white font-bold">690AM</div>
    <div className="text-5xl text-white font-bold">106.7FM</div>
    <div className="text-lg text-white uppercase font-bold mt-1">On the air in Tucson, AZ</div>
  </div>
  <div className="p-6 bg-gradient-to-b from-gray-800 to-gray-900">
    <div className="border-l-4 pl-3 font-bold text-xl mb-3 border-l-green-500 uppercase text-white">
      Providing Solid Bible Teachings and Uplifting Worship 24/7
    </div>
    <p className="text-white/80">
      Reach Radio first went online in February 2016, and on the air in February 2017.
      Our goal is simple, to bring the life-saving message and hope of the gospel to
      as many as can hear via the Tucson radio airwaves.
    </p>
  </div>
</div>
```
With:
```tsx
{/* Frequency hero */}
<div className="grid md:grid-cols-2 rounded-[18px] overflow-hidden border border-white/5">
  <div className="text-center p-6 bg-[#84b84f] flex flex-col justify-center items-center">
    <div className="text-5xl text-[#0a1305] font-extrabold">690AM</div>
    <div className="text-5xl text-[#0a1305] font-extrabold">106.7FM</div>
    <div className="text-sm text-[#0a1305]/80 uppercase font-bold tracking-widest mt-2">On the air in Tucson, AZ</div>
  </div>
  <div className="p-6 bg-[#1c2128]">
    <div className="border-l-4 pl-3 font-bold text-sm mb-3 border-l-[#84b84f] uppercase text-white tracking-wide">
      Providing Solid Bible Teachings and Uplifting Worship 24/7
    </div>
    <p className="text-white/70 text-sm leading-relaxed">
      Reach Radio first went online in February 2016, and on the air in February 2017.
      Our goal is simple, to bring the life-saving message and hope of the gospel to
      as many as can hear via the Tucson radio airwaves.
    </p>
  </div>
</div>
```

- [ ] **Step 4: Update app download section**

Find (the outer wrapper div only — leave SVG content untouched):
```tsx
<div className="bg-gray-700/40 p-5 rounded">
  <h2 className="text-white text-2xl mb-4">Download App</h2>
```
Replace with:
```tsx
<div className="bg-[#1c2128] border border-white/5 rounded-[18px] p-5">
  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-4">Download App</h2>
```

Also update both `<a>` wrappers inside this section — change `focus-visible:rounded` → `focus-visible:ring-white/50 focus-visible:rounded-sm`:
```tsx
className="inline-block hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:rounded-sm"
```
(Apply this className to both the App Store and Google Play `<a>` elements.)

- [ ] **Step 5: Update contact form section**

Find:
```tsx
<div className="bg-gray-700/40 p-5 rounded">
  <h2 className="text-white text-2xl mb-2">Got Questions?</h2>
  <p className="text-white/60 text-sm mb-4">Send us a message and we will get back to you as soon as possible.</p>
  <ContactForm />
</div>
```
Replace with:
```tsx
<div className="bg-[#1c2128] border border-white/5 rounded-[18px] p-5">
  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-2">Got Questions?</h2>
  <p className="text-white/60 text-sm mb-4">Send us a message and we will get back to you as soon as possible.</p>
  <ContactForm />
</div>
```

- [ ] **Step 6: Update privacy policy link row**

Find:
```tsx
<Link
  href="/about/privacy-policy"
  className="block bg-gray-700/40 p-5 rounded hover:bg-gray-700/60 transition-colors cursor-pointer group"
>
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-white text-2xl mb-1">Privacy Policy</h2>
      <p className="text-white/60 text-sm">How we collect and protect your information</p>
    </div>
    <svg
      className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors flex-shrink-0 ml-4"
```
Replace with:
```tsx
<Link
  href="/about/privacy-policy"
  className="block bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-white/20 transition-colors cursor-pointer group"
>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-white font-semibold text-sm">Privacy Policy</p>
      <p className="text-white/50 text-xs mt-1">How we collect and protect your information</p>
    </div>
    <svg
      className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors flex-shrink-0 ml-4"
```
Note: `<h2>` becomes `<p>` here — this section is a navigation link row, not a page section, so `<p>` with appropriate styling is semantically cleaner.

- [ ] **Step 7: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/app/about/page.tsx
git commit -m "style(about): align to design system — hero, card surfaces, headings, a11y h1"
```

---

## Task 6: Home Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/home/RadioPlayer.tsx`
- Modify: `src/components/home/TodaySchedule.tsx`

### 6a — `page.tsx`

- [ ] **Step 1: Update container padding and section heading**

Find:
```tsx
<div className="px-3 pt-3 space-y-6 pb-32">
```
Replace with:
```tsx
<div className="px-4 md:px-8 pt-4 space-y-6 pb-32">
```

Find:
```tsx
<h2 className="text-white font-bold text-lg px-3 uppercase mb-3">Playing Next</h2>
```
Replace with:
```tsx
<h2 className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/55 mb-3 px-1">Playing Next</h2>
```

### 6b — `RadioPlayer.tsx`

- [ ] **Step 2: Update player card surface**

Find:
```tsx
<div ref={containerRef} className="p-2 pb-5 md:p-5 bg-gray-700/50 rounded">
```
Replace with:
```tsx
<div ref={containerRef} className="p-2 pb-5 md:p-5 bg-[#1c2128] border border-white/5 rounded-[18px]">
```

Find the album art `<Image>`:
```tsx
className="max-w-[420px] max-h-64 rounded object-contain hover:opacity-90 transition-opacity"
```
Replace with:
```tsx
className="max-w-[420px] max-h-64 rounded-xl object-contain hover:opacity-90 transition-opacity"
```

### 6c — `TodaySchedule.tsx`

- [ ] **Step 3: Update empty state**

Find:
```tsx
<div className="flex items-center gap-5 bg-gray-700 p-2 rounded text-white">
```
Replace with:
```tsx
<div className="flex items-center gap-5 bg-white/5 border border-white/10 rounded-xl p-2 text-white">
```

- [ ] **Step 4: Update music slot row**

Find:
```tsx
className="schedule-row flex gap-5 bg-gray-700 p-2 rounded"
```
Replace with:
```tsx
className="schedule-row flex gap-5 bg-white/5 border border-white/10 rounded-xl p-2"
```

- [ ] **Step 5: Update link slot row**

Find:
```tsx
className="schedule-row flex items-center justify-between flex-wrap bg-gray-700 p-2 rounded hover:bg-gray-700/80 transition-colors"
```
Replace with:
```tsx
className="schedule-row flex items-center justify-between flex-wrap bg-white/5 border border-white/10 rounded-xl p-2 hover:bg-white/10 hover:border-white/20 transition-colors"
```

- [ ] **Step 6: Update image border radius in TodaySchedule**

Find (both occurrences of the image className inside the schedule rows):
```tsx
className="object-cover rounded"
```
Replace with:
```tsx
className="object-cover rounded-lg"
```

- [ ] **Step 7: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/components/home/RadioPlayer.tsx src/components/home/TodaySchedule.tsx
git commit -m "style(home): align to design system — player card, schedule rows, section heading"
```

---

## Task 7: Privacy Policy Page (Minor)

**Files:**
- Modify: `src/app/about/privacy-policy/page.tsx`

The page appropriately uses `prose prose-invert` for long-form content. Only the inner padding needs alignment with the rest of the site.

- [ ] **Step 1: Update inner container padding**

Find:
```tsx
<div className="px-4 pt-8 pb-6">
```
Replace with:
```tsx
<div className="px-4 md:px-8 pt-6 pb-8">
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/about/privacy-policy/page.tsx
git commit -m "style(privacy-policy): align container padding to design system"
```

---

## Final Verification

- [ ] **Full type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Build**

```bash
npm run build 2>&1 | tail -30
```
Expected: successful build, no type errors

- [ ] **Visual verification — start dev server**

```bash
npm run dev
```

Check each page at http://localhost:3000 — confirm:
- `/` — player card is dark (`#1c2128`) with subtle border, schedule rows are `bg-white/5` with `rounded-xl`, "Playing Next" label is small muted allcaps
- `/about` — frequency hero uses brand green `#84b84f` (dark text on green), right panel uses `#1c2128`, all cards use dark card surface with `rounded-[18px]`
- `/about/privacy-policy` — prose content, consistent padding
- `/donate` — h1 matches design system scale, skeleton uses `bg-[#1c2128]` with `bg-white/5` blocks
- `/scheduled-list` — rows use `bg-white/5 border border-white/10 rounded-xl`, day labels are tiny allcaps `text-white/55`
- `/sleep-timer` — timer buttons use `bg-white/5 border border-white/10 rounded-xl`, h1 matches scale, cancel button is `rounded-full`
