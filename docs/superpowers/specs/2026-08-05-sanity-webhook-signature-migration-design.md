# Sanity Webhook Signature Migration (@sanity/webhook)

**Date:** 2026-08-05
**Status:** Draft — pending implementation plans
**Scope:** Cross-repo — reach-radio-nextjs, calvarytucson-nextjs, calvarytucson-svelte
**Repos affected:** all three are independent git repos; no monorepo/workspace tooling links them

---

## Background

All three Sanity-backed projects independently implement a Sanity → app cache-revalidation
webhook, and all three independently converged on the same authentication pattern: a static
shared secret, sent as a custom header, compared with `crypto.timingSafeEqual`. None use
Sanity's own signed-webhook feature.

Current state:

| Repo | Endpoint | Auth header | Env var | Replay protection |
|---|---|---|---|---|
| reach-radio-nextjs | `src/app/api/revalidate/route.ts` | `x-webhook-secret` | `SANITY_WEBHOOK_SECRET` | Yes — checks payload `_updatedAt` against a 5-minute window |
| calvarytucson-nextjs | `src/app/api/revalidate/route.ts` | `Authorization: Bearer <secret>` | `SANITY_REVALIDATE_SECRET` | None |
| calvarytucson-svelte | `src/routes/api/sanity-revalidate/+server.ts` (+ `$lib/server/sanity-revalidate.ts` helper) | `Authorization: Bearer <secret>` | `SANITY_REVALIDATE_SECRET` | None |

This came up while executing reach-radio-nextjs's PPR Phase 3 plan
(`docs/superpowers/plans/2026-05-29-ppr-phase-3-cache-invalidation.md`), whose Task 1 originally
prescribed installing `@sanity/webhook` and rewriting the endpoint's auth — but the plan (written
2026-05-29) predates several since-shipped fixes to that endpoint and its description of the
"existing bugs" no longer matches current code (see Pre-Flight Findings below). Re-evaluating
Task 1 from scratch raised the question of whether to adopt `@sanity/webhook` properly, and
whether to do it consistently across all three projects rather than just this one.

### Pre-flight findings (reach-radio-nextjs, confirmed against current code)

- The plan's "Bug 1" (`revalidateTag(tag, 'days')` is invalid) does not match current code, which
  already calls `revalidateTag(tag, 'max')` — the two-arg form is the *recommended* signature in
  this Next.js version (verified against `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md`),
  not a bug.
- The plan's "Bug 3" (weak plain-string auth) does not match current code either — it already uses
  `timingSafeEqual` plus a replay window (commits `8906cef`, `c37ff80`, `c6e2a8b`, `20bb21f`).
- The plan's "Bug 2" (TAG_MAP key-name mismatch) is partially stale: the `settings`/`appSettings`
  key-naming bug is fixed — current `TAG_MAP` uses `siteSettings: 'siteSettings'` and
  `appSettings: 'appSettings'`, matching the tags actually used at the call sites (`layout.tsx`,
  `about/page.tsx`, `native-config/route.ts`, `RadioStationSchema.tsx`, `WebSiteSchema.tsx`). The
  "no fallback for unknown `_type`" part is also handled — the route returns
  `{ revalidated: false, reason: 'unknown document type' }` rather than erroring. The remaining
  part of Bug 2 is still live and is exactly the schedule-tag bug described next.
- A real bug the plan missed: Sanity has no `schedule` document type — schedule data is a field
  *on* the `teacher` document (confirmed via `src/lib/sanity/queries.ts` GROQ:
  `_type == "teacher" && count(schedule...)`). `TodaySchedule.tsx` (the home page's Suspense
  component) caches under tag `'schedule'`, but nothing calls `revalidateTag('schedule')` —
  the route's `TAG_MAP` maps a `schedule` `_type` key (which Sanity never sends) to `'teachers'`.
  Net effect: editing a teacher's schedule in Sanity never invalidates the home page's schedule
  cache. This fix is folded into this migration (see reach-radio-nextjs section below) rather than
  landing as a separate change, since it touches the same endpoint.
- Home page PPR (Phase 3 Task 2) and native-config `webUrl` (Phase 3 Task 4) were both already
  done via unrelated commits since the plan was written — confirmed via clean build (`/` shows
  `◐`) and reading `src/app/api/native-config/route.ts` (uses `SITE_URL` constant, commit
  `b6b4c88`). No action needed for either in this migration.

### Why not just fix reach-radio-nextjs and move on

The plan's original decision (before this migration was proposed) was to keep the current
timingSafeEqual design as-is, matching the other two projects' identical pattern, and fix only the
schedule-tag bug. That's still a valid option — the current scheme is not insecure for this use
case (worst case of a forged request, if the secret ever leaked, is a spurious cache revalidation,
not data exposure or mutation). But standardizing on Sanity's own signed-webhook mechanism
(`@sanity/webhook`) buys one audited library and one mental model across all three projects instead
of three hand-rolled variants — worth doing given all three need to touch this code anyway.

---

## Design

### 1. Core mechanism swap (all 3 repos)

Replace the shared-secret comparison with `@sanity/webhook`'s `isValidSignature` (or
`assertValidSignature`), verifying the `sanity-webhook-signature` header (exported as
`SIGNATURE_HEADER_NAME`) that Sanity sends automatically once a webhook's "Secret" field is
configured in the Sanity dashboard — replacing the current custom-header/Bearer-token
configuration.

`@sanity/webhook` v4.0.4 (published ~1yr ago, MIT, zero deps, maintained by sanity-io) signs
`${timestamp}.${rawBody}` with HMAC-SHA256 via the Web Crypto API. Verification requires the
**raw, unparsed body string** — signing a re-serialized/re-parsed JSON object can produce a
different byte sequence than what Sanity signed (whitespace, key order), so the signature check
must happen before `JSON.parse`. All three current routes call `.json()` directly; all three need
to read the raw text body first (`request.text()` in Next.js Route Handlers / SvelteKit), verify,
then parse.

```
1. const rawBody = await req.text()
2. const signature = req.headers.get(SIGNATURE_HEADER_NAME)
3. verify signature against rawBody (includes replay check, below)
4. const payload = JSON.parse(rawBody)
5. proceed with existing tag/path revalidation logic, unchanged
```

### 2. Replay protection

`isValidSignature`/`assertValidSignature` validate the HMAC only. Reading the library's source
(`dist/index.mjs`) confirms `decodeSignatureHeader` enforces only a sanity-floor constant
(`MINIMUM_TIMESTAMP = 1609459200000`, i.e. "not before 2021") on the embedded timestamp — it does
**not** check that the timestamp is recent. There is no built-in replay-window protection.

Today only reach-radio-nextjs has any replay defense, and it trusts the payload's `_updatedAt`
field — fragile, since it depends on the Sanity GROQ webhook projection including that field at
all.

New design, applied identically to all 3 repos: after signature verification succeeds, decode the
signature header with the library's exported `decodeSignatureHeader(signature)` to get its
embedded `timestamp` (always present — it's part of what was signed, so it can't be tampered with
independently of invalidating the signature itself), and reject if
`Date.now() - timestamp > 5 * 60_000`. This is the same pattern Stripe uses for its webhook
signatures, and is strictly more robust than trusting a payload field, since it doesn't depend on
what the GROQ projection includes.

**Exact failure response:** an expired-replay-window request returns the identical response as an
invalid signature — HTTP `401`, no distinguishing body field. Both cases mean "this request cannot
be trusted"; treating them as one outcome keeps the check a simple boolean everywhere, which
matters because calvarytucson-svelte's `hasValidRevalidateSecret` helper returns a plain
`Promise<boolean>` and has no natural way to surface a second failure mode without complicating its
signature. (`400` was considered — "malformed/stale request" rather than "auth failure" — but
rejected specifically to keep all three repos' observable behavior identical for the same input,
which is the stated goal of this migration.)

### 3. Per-repo scope

| Repo | File(s) | Changes beyond the core swap |
|---|---|---|
| **reach-radio-nextjs** | `src/app/api/revalidate/route.ts` | Rename env var `SANITY_WEBHOOK_SECRET` → `SANITY_REVALIDATE_SECRET` (Vercel env + Sanity dashboard). Fold in the schedule-tag fix: when `_type === 'teacher'`, also `revalidateTag('schedule')` alongside `'teachers'`. `TAG_MAP` otherwise unchanged. |
| **calvarytucson-nextjs** | `src/app/api/revalidate/route.ts` | Auth swap only. `TYPE_TO_TAGS` map and slug-tag logic untouched. Env var name already `SANITY_REVALIDATE_SECRET` — no rename needed. |
| **calvarytucson-svelte** | `src/routes/api/sanity-revalidate/+server.ts`, `src/lib/server/sanity-revalidate.ts` | `hasValidRevalidateSecret` rewritten to wrap `isValidSignature` + the timestamp check instead of a `Bearer`-header compare. `resolvePaths`/`TYPE_TO_PATHS` and all path-resolution logic untouched. Response shapes (404-as-`gone`, 502 on partial failure, etc.) untouched. Env var name already `SANITY_REVALIDATE_SECRET` — no rename needed. |

Sharing mechanism: **consistent duplication**, not a shared package. All three repos are fully
independent (no workspace tooling, no shared internal npm registry) — introducing one would be new
infra disproportionate to ~30 lines of verification logic. Instead, the same code shape (same
`@sanity/webhook` calls, same replay-window constant, same env var name, same error-response
shape where each project's existing conventions allow) is written once here and copied into each
repo's implementation plan, so any future third eye reading any of the three sees the same
pattern.

### 4. Rollout order

reach-radio-nextjs first (active session, unblocks the paused Phase 3 plan), then
calvarytucson-nextjs, then calvarytucson-svelte, as separate follow-up sessions in each repo. No
functional dependency between repos — this is purely because only one repo's session is open right
now.

### 5. Testing

Per repo: unit tests covering valid signature / invalid signature / tampered body / expired
timestamp / malformed signature header. `@sanity/webhook` does not export its internal
`createHS256Signature` helper (only the top-level verify functions and `decodeSignatureHeader` /
`encodeSignatureHeader` are public — `encodeSignatureHeader` *is* exported and is sufficient to
construct valid test signatures), so tests use `encodeSignatureHeader(payload, timestamp, secret)`
to build valid signature headers directly rather than reimplementing HMAC signing.

Manual end-to-end verification per repo, after deploy: reconfigure the Sanity dashboard webhook to
use the native "Secret" field (removing the old custom header/query-param config), publish a real
test document, confirm delivery succeeds in the Sanity dashboard and the expected tags/paths
revalidate.

### 6. Docs

This document is the single shared design/rationale doc, committed here in reach-radio-nextjs.
Each repo gets its own implementation plan in its own `docs/superpowers/plans/`:

- reach-radio-nextjs: folds into the existing paused
  `docs/superpowers/plans/2026-05-29-ppr-phase-3-cache-invalidation.md` — that plan's Task 1 gets
  rewritten to reflect this design instead of its original (stale) bug list.
- calvarytucson-nextjs: new plan, to be written in a future session in that repo, referencing this
  doc.
- calvarytucson-svelte: new plan, to be written in a future session in that repo, referencing this
  doc.

---

## Out of scope

- Any change to tag-mapping or path-resolution logic (`TAG_MAP`, `TYPE_TO_TAGS`,
  `TYPE_TO_PATHS`) — these reflect each project's distinct content model and are correct as-is.
- A shared internal package — explicitly rejected in favor of consistent duplication (see above).
- Standardizing calvarytucson-nextjs's or calvarytucson-svelte's env var names — both already use
  `SANITY_REVALIDATE_SECRET`, only reach-radio-nextjs needs to rename.
