# Streaming Routes: Rate Limiting & Connection Duration — Design

## Problem

Three routes share `src/lib/rate-limit.ts`, an in-memory, per-lambda-instance
sliding-window limiter:

- `/api/audio-stream` (max 10/60s)
- `/api/stream-info` (max 30/60s)
- `/api/stream-info-sse` (max 10/60s)

Two independent defects, both discovered during go-to-prod review
(2026-09-11), before this app has ever served real public listener traffic:

1. **The limiter under-protects and over-blocks at the same time.** Its state
   lives in one Vercel function instance's memory. Under real traffic, Vercel
   runs multiple concurrent instances, each with its own empty counter — a
   single IP can exceed the stated limit by a multiple of however many
   instances are live, and a redeploy or cold start silently resets it. In
   the other direction, the limiter keys purely on IP, but this app expects
   shared-IP audiences by nature (a church building's WiFi, a household with
   several devices, carrier-grade NAT) — normal, low-abuse usage from behind
   one IP can trip a 10-requests-per-60s threshold that was tuned for
   scripted abuse, not concurrent legitimate listeners.

2. **Neither streaming route sets `maxDuration`.** Both `audio-stream` and
   `stream-info-sse` return a long-lived streamed `Response` body. Without an
   explicit `maxDuration` export, a Next.js route on Vercel Pro silently
   inherits the project's *default* max function duration — 300 seconds (5
   minutes), confirmed both against current Vercel docs and empirically:
   `curl -N -m 400 -w "%{http_code} %{time_total}"` against the live
   production routes (2026-09-11) confirmed both are cut off right at that
   ceiling: `audio-stream` at `time_total=301.99s`, `stream-info-sse` at
   `time_total=300.51s`. This means:
   - `stream-info-sse`'s own code assumes a 30-minute connection lifetime
     (`MAX_CONNECTION_MS`) that has never actually been reachable in
     production — every connection is really being cut at 5 minutes.
   - `audio-stream` has no explicit lifetime assumption at all; it is also
     silently capped at 5 minutes, a ceiling nobody chose on purpose.
   - Every forced cutoff is a reconnect, and every reconnect is a fresh
     request against whichever rate limiter is in front of the route — so
     defect 2 amplifies defect 1: more frequent forced reconnects than
     intended means more frequent bursts against a per-IP counter that
     already over-blocks shared-IP audiences.

A third, smaller finding: `audio-stream`'s client-side reconnect logic
(`AudioProvider.tsx`) only runs from the `<audio>` element's `onError`
handler. Whether a Vercel-side mid-stream cutoff reliably fires `error`
(rather than leaving the element stalled with no data and no error) is
unverified. This is flagged as a follow-up, not fixed in this design — see
Non-goals.

## Goals

- Replace the in-app rate limiter with enforcement that is correct across
  multiple concurrent Vercel instances (Vercel Firewall, edge-enforced).
- Set thresholds appropriate for a public radio stream with expected
  shared-IP audiences, not defaults borrowed from generic API abuse
  prevention.
- Give both streaming routes an explicit, intentional `maxDuration` instead
  of an unnoticed platform default.
- Stagger `stream-info-sse`'s forced reconnects so simultaneously-opened
  connections don't all reconnect in the same instant.

## Non-goals

- `reach-radio-web` (the legacy Astro/Cloudflare site) — separate project,
  not part of this app's deploy, out of scope.
- Native iOS/Android app changes — separate repos, separate release cycles,
  unaffected by this change.
- Contact-form rate limiting — a different, unrelated mechanism, untouched.
- Fixing `AudioProvider.tsx`'s `onError`-only reconnect gap — flagged above
  as a real risk, but needs a manual device/browser test to confirm actual
  behavior before writing a fix; tracked as a follow-up item, not built
  here.
- Choosing Vercel's 30-minute "extended max duration" Beta tier — deferred
  in favor of the stable, generally-available 800-second ceiling, since this
  is a reliability fix and shouldn't introduce a Beta-feature dependency to
  do it. Can reconsider once that tier is GA.

## Design

### 1. Rate limiting: Vercel Firewall replaces `src/lib/rate-limit.ts`

Remove `src/lib/rate-limit.ts` and its import/usage in all three consumers.
Each route's manual "check limiter → return 429" branch is deleted; the
route body becomes just its existing success-path logic. Enforcement moves
to Vercel Firewall custom rules (Project Settings → Firewall in the
dashboard — a manual step, not something committed to the repo), one rule
per route:

Confirmed against current Vercel docs (2026-09-11): on the Pro plan, the
only available counting algorithm is **Fixed Window** (Token Bucket is
Enterprise-only), the counting window must be between 10s and 10 minutes,
and available counting keys are IP address or JA4 digest. All three rules
below fit within those constraints.

| Route | Condition | Algorithm | Time Window | Request Limit | Key | Then (exceeded) |
|---|---|---|---|---|---|---|
| `/api/audio-stream` | Path equals `/api/audio-stream` | Fixed Window | 60s | 60 | IP Address | Deny |
| `/api/stream-info` | Path equals `/api/stream-info` | Fixed Window | 60s | 60 | IP Address | Deny |
| `/api/stream-info-sse` | Path equals `/api/stream-info-sse` | Fixed Window | 5 min | 30 | IP Address | Deny |

These numbers are intentionally looser than today's in-app values (10/60s,
30/60s) — the previous thresholds were never validated against real traffic
and were tuned for generic API-abuse prevention, not a public stream with an
expected physical/shared-IP audience. They are starting points: Vercel
Firewall's dashboard logs/analytics let them be tuned up or down after real
listener traffic arrives, with no code change or redeploy required.

Because Firewall enforcement happens at the edge, before a request reaches
a function instance, this fixes most of defect 1's under-protection half —
but not all of it. Per Vercel's own docs, rate-limit counters are tracked
**per region**, not globally: traffic matching the same key (IP) across
multiple regions can still exceed the configured limit in aggregate. This
is a real caveat, not a rounding error, but it's a much coarser and more
stable unit than the in-app limiter's per-lambda-instance counting (a
handful of regions vs. however many concurrent function instances Vercel
happens to be running), so it's still a meaningful improvement, not a full
fix to a single global counter.

### 2. Explicit `maxDuration` on both streaming routes

- **`src/app/api/stream-info-sse/route.ts`**
  - Add `export const maxDuration = 780` (13 minutes — under Vercel Pro's
    generally-available 800-second ceiling, with headroom for cleanup).
  - Change `MAX_CONNECTION_MS` from a fixed 30-minute constant to a jittered
    range computed per connection, e.g. `600_000 + Math.random() * 120_000`
    (10–12 minutes). This keeps the intent of "force periodic reconnects"
    but prevents connections opened around the same time (e.g. right when a
    broadcast starts) from all reconnecting in the same instant — which is
    exactly the kind of self-inflicted burst that would otherwise trip the
    new Firewall rule.
  - The existing 15-second `: keepalive\n\n` comment interval is unaffected
    and remains correct — Vercel's own guidance for long-running streamed
    responses is to keep sending data, which this route already does.

- **`src/app/api/audio-stream/route.ts`**
  - Add `export const maxDuration = 780`, matching the SSE route. This
    doesn't change normal playback behavior, but removes the current
    silent dependency on a 5-minute ceiling nobody chose, and reduces
    reconnect frequency (and therefore Firewall-rule load) from "every 5
    minutes, unintentionally" to "every ~13 minutes, deliberately."

- **`src/app/api/stream-info/route.ts`**
  - No `maxDuration` change — this route makes one short upstream fetch and
    returns, it isn't a long-lived stream. Only its rate-limiter usage is
    removed per section 1.

### 3. Rollout / manual steps

Since Firewall rules are dashboard configuration, not code, the plan (next
step after this spec) will separate "code changes I make" from "dashboard
steps you do," in that order — code first, so the routes are already
limiter-free before the Firewall rules take over enforcement.

Per Vercel's own documented best practice, each rule should be created with
a **Log** action first, its 10-minute live traffic view checked to confirm
it's matching the intended requests, and only then switched to **Deny** —
rather than going straight to Deny and finding out afterward that the
condition was wrong. Vercel also supports describing a rule in natural
language (e.g. "Rate limit /api/audio-stream to 60 requests per minute per
IP") and having it generate the condition/algorithm/window/key
configuration automatically — the plan's dashboard task will give the exact
field values from the table above either way, so this is a convenience, not
a requirement.

## Testing

- Each affected route has an existing `'returns 429 when rate limit
  exceeded'` unit test (`tests/unit/api-audio-stream.test.ts`,
  `tests/unit/api-stream-info-sse.test.ts`) asserting the in-app limiter's
  429 response. These get deleted, not adapted — there is no in-app 429
  behavior left to test once Firewall owns enforcement at the edge, and a
  unit test can't exercise a dashboard-configured rule.
  `tests/unit/action-contact.test.ts` is unrelated (contact-form limiting is
  a separate mechanism, untouched) and needs no change.
- Manual verification after deploy:
  - `stream-info-sse`: hold a connection open past 5 minutes (proves
    `maxDuration` took effect — the old, unintentional ceiling), then keep
    watching through the new ~10-12 minute jittered boundary and confirm
    it reconnects cleanly there.
  - `audio-stream`: play continuously past 5 minutes (uneventful, proves
    `maxDuration` took effect), then through the ~13-minute mark — this is
    the boundary that actually matters, since recovery there depends on
    `AudioProvider.tsx`'s `onError`-only reconnect path (see Open risks).
    Confirm explicitly whether the reconnect is a brief gap or a silence
    that never recovers.
  - Firewall rules: confirm a burst above each threshold gets a 429 from
    the edge, and that normal single-session usage never trips them. Do
    this again after the in-app limiter is fully removed, not just once
    while both are still active — otherwise the in-app limiter's lower
    threshold masks whether Firewall's own threshold is what's enforcing.

## Open risks / follow-ups (not built here)

- `AudioProvider.tsx`'s `onError`-only reconnect path (see Problem, point
  3) — needs a real-device verification pass before deciding whether an
  `onStalled` watchdog is actually necessary.
- Firewall rule thresholds are unvalidated starting points — first real
  traffic window after the `reach.radio` DNS cutover is the actual test;
  revisit numbers from Firewall's logs then.
- `maxDuration = 780` relocates the forced cutoff, it does not remove it.
  A live radio stream is unbounded, so every `audio-stream` and
  `stream-info-sse` listener still gets a forced reconnect every ~13
  minutes, forever — just deliberately and infrequently instead of
  accidentally and every 5 minutes. Worth recording so nobody later reads
  "fixed" and stops looking for why a stream still briefly hiccups
  periodically.
