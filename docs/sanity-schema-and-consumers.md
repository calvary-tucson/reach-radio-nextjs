# Reach Radio — Sanity Schema & Consumers

How the Reach Radio Sanity project feeds the website, the legacy Astro site, and the iOS/Android apps.

- **Audited:** 2026-10-09 (read-only). Live data read via public CDN GET; no secrets read.
- **Legend:** **VERIFIED** = seen in code or live response. **INFERRED** = reasoned, not proven. **UNKNOWN** = could not check.

---

## 1. Project identity

| Item | Value | Status |
|---|---|---|
| Sanity project ID | `bk05c6rl` | VERIFIED (`sanity-cms-administration/studios/reach-radio/sanity.config.ts:10`, `sanity.cli.ts:5`, `src/lib/sanity/image.ts:28` fallback) |
| Dataset | `production` | VERIFIED |
| Studio | `~/Documents/Development/sanity-cms-administration/studios/reach-radio` | VERIFIED |
| Plugins | `structureTool`, `visionTool`, `sanity-plugin-media` | VERIFIED |
| Dataset visibility | Public read (anonymous GET to `bk05c6rl.apicdn.sanity.io` works) | VERIFIED |

**Not the same project as Calvary Tucson.** The Calvary projects use `l5km0p6r` (main) and `fv5h2rg3` (members). Reach Radio is its own project; never mix the IDs.

Env vars (Next.js, Vercel Production, names only): `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_WEBHOOK_SECRET`. Values are encrypted and were not read. The code throws at import if `SANITY_PROJECT_ID`/`SANITY_DATASET` are missing (`src/lib/sanity/client.ts:5-9`).

---

## 2. Schema (3 document types)

Source: `studios/reach-radio/schemas/` (`index.ts` exports `teacher`, `siteSettings`, `appSettings`). Live dataset contains exactly these types plus `sanity.imageAsset` (VERIFIED).

### `appSettings` — singleton (by ID, not enforced by schema)
Fixed document ID: `a2939b52-e844-45f4-ba97-c335991cea4b` (hardcoded in Next.js `src/lib/sanity/queries.ts` `APP_SETTINGS_ID` and in Astro `MediaBarContainer.astro:13`).

| Field | Type | Live value (2026-10-09) |
|---|---|---|
| `hostURL` | string | `https://reach-radio.webapp-0a8.workers.dev/` — **STALE** (old Cloudflare Workers site) |
| `radioAudioURL` | string | `https://reach.radio/api/audio-stream` |
| `defaultArtworkURL` | string | cdn.sanity.io image `5891a205…-1024x1024.jpg?w=420&fm=webp` |

Last updated 2024-10-16 (VERIFIED). The schema does **not** restrict this to one document; nothing stops an editor creating a second `appSettings`, which every consumer would ignore because they query by ID.

### `siteSettings` — singleton (queried with `[0]`)
Live doc ID `4cc36631-7855-400e-963d-339f7a68e284`, last updated 2023-05-29.

| Field | Type | Notes |
|---|---|---|
| `siteTitle` | string | live: "Reach Radio Tucson" |
| `siteDescription` | text | live: set |
| `siteIconLight` / `siteIconDark` | image | both present live |
| `codes` | array of `code` (JS text) / `src` (URL) | schema only; **0 entries live**; no consumer found in Next.js `src` or Astro `src` (grep) — INFERRED unused |

**Schema drift (VERIFIED):** `siteSettingsQuery` (`queries.ts:70-79`) and Astro `SEO.astro` read `siteKeywords`, `twitterHandle`, `facebookPage`. These fields are **not in the schema** and are `null` in live data. Code falls back to hardcoded keywords (`layout.tsx:32`). Either add the fields to the schema or remove them from queries.

### `teacher` — 22 documents live, 21 with a schedule
| Field | Type | Notes |
|---|---|---|
| `name` | object `{first, last}` | required |
| `slug` | slug | required; auto-generated from name via `slugify` |
| `photo` | image | |
| `title` | string | show title |
| `subtitle` | string | show subtitle |
| `schedule[]` | `{day (Mon–Sun list), times[]{startTime, endTime}}` | times are free-text strings like `6:00 PM` (no validation) |
| `links[]` | `{title, url}` | `url` is a plain string, not `url` type |

There is **no separate `schedule` document type** — schedule is embedded in `teacher`. Schedule pages are derived by filtering teachers.

---

## 3. Field → consumer map

### 3.1 Next.js website (`reach-radio-nextjs`)
Client: `src/lib/sanity/client.ts` — `apiVersion 2024-02-22`, `perspective: 'published'`, `useCdn: true`. `sanityFetch` is `'use cache'` + `cacheLife('days')`; `sanityFetchHourly` (`cacheLife('hours')`) exists but has **no callers** (VERIFIED by grep).

| Data | Query | Cache tag | Used by |
|---|---|---|---|
| appSettings.radioAudioURL | `appSettingsQuery` | `appSettings` | `app/layout.tsx:103` → `BridgeInit` + `AudioProvider` stream URL; `api/native-config` |
| appSettings.hostURL | `appSettingsQuery` | `appSettings` | `api/native-config` only |
| appSettings.defaultArtworkURL | **not queried by web** | — | iOS/Android hardcode the same image URL instead |
| siteSettings | `siteSettingsQuery` | `siteSettings` | `layout.tsx:42` metadata/icons, `about/page.tsx`, `RadioStationSchema`, `WebSiteSchema` |
| teacher list | `teacherListQuery` | `teachers` | `teachers/page.tsx`, `fetchAllTeacherData` (search page + `api/teachers/search-data`) |
| teacher detail | `teacherDetailQuery` | `teachers` | `teachers/[slug]/page.tsx`, intercepted modal `@modal/(...)teachers/[slug]`, `opengraph-image.tsx` |
| slugs | `teacherSlugsQuery`, `teacherSlugsWithDatesQuery` | `teachers` | `generateStaticParams`, `sitemap.ts` (`_updatedAt` → lastmod) |
| recommended | `highlightedTeachersQuery` | `teachers` | `RecommendedTeachers`, teacher pages |
| names+photos | `teacherNamesAndPhotosQuery` | `teachers` | `api/teachers-list`, `lib/teacherCache.ts` |
| full schedule | `fullScheduleQuery` | `teachers` | `teachers/page.tsx`, search |
| today's schedule | `scheduleQuery` | **`schedule`** | `components/home/TodaySchedule.tsx:45` |
| images | `buildSanityImageUrl*` | — | `SanityImage.tsx`; builds `cdn.sanity.io/images/<project>/<dataset>/…` |

Hardcoded CDN image `5891a205…jpg` (site/OG/fallback artwork) appears in `donate/layout.tsx:11`, `teachers/page.tsx:13`, `TodaySchedule.tsx:14`, `constants.ts:8`.

### 3.2 Cache invalidation (webhook)
`src/app/api/revalidate/route.ts` (POST):
- Auth: `x-webhook-secret` header vs `SANITY_WEBHOOK_SECRET`, `timingSafeEqual` (VERIFIED).
- Replay protection: if body has `_updatedAt`, rejects older than 5 min. **If the Sanity webhook projection omits `_updatedAt`, no replay check runs** (VERIFIED in code; actual webhook projection UNKNOWN).
- `TAG_MAP`: `teacher→teachers`, `schedule→teachers`, `siteSettings→siteSettings`, `appSettings→appSettings`. Calls `revalidateTag(tag, 'max')`.
- Unknown `_type` → 200 `{revalidated:false}`.

**Gap (VERIFIED):** `TodaySchedule.tsx` caches with tag **`schedule`**, but the webhook only ever revalidates `teachers`, `siteSettings`, `appSettings`. Nothing revalidates `schedule`. After a teacher's schedule is edited, the home-page "today" list can stay stale up to the `days` cache life. Fix: tag it `teachers`, or add `teacher→['teachers','schedule']`. Also `schedule` as a `_type` key in `TAG_MAP` is dead (no such type).

**Webhook configuration in Sanity (URL, filter, projection, secret): UNKNOWN.** It lives in the Sanity manage dashboard / API and needs a token; not checked. Confirm it points at the production hostname (currently `reach-radio-nextjs.vercel.app`, later `reach.radio`) and sends `_type` and `_updatedAt`. Related spec: `docs/superpowers/specs/2026-08-05-sanity-webhook-signature-migration-design.md`.

### 3.3 `/api/native-config` (consumed by iOS v4 only)
`src/app/api/native-config/route.ts`, `Cache-Control: public, max-age=300`, tag `appSettings`.

| Response field | Source | Live value |
|---|---|---|
| `protocolVersion` | constant `1` | 1 |
| `streamUrl` | `appSettings.radioAudioURL` ?? `FALLBACK_STREAM_URL` (radiojar) | `https://reach.radio/api/audio-stream` |
| `hostURL` | `appSettings.hostURL` \|\| `SITE_URL` | stale workers.dev (see §2) |
| `webUrl` | `SITE_URL` (`NEXT_PUBLIC_SITE_URL` or vercel.app fallback, `constants.ts:1`) | `https://reach-radio-nextjs.vercel.app` |
| `minAppVersion` | constants | ios/android `1.0.0` |

- **iOS v4** (`Reach_Radio_NativeApp.swift:62-72`): loads `webUrl` as the WebView origin; falls back to `hostURL` only if `webUrl` is absent. Sets the SSE base and stream URL from the response. Compares `minAppVersion.ios` to force-update. So **`webUrl` (i.e. `NEXT_PUBLIC_SITE_URL`) decides which site v4 loads.** `hostURL` (stale) is only a fallback.
- **Android:** does **not** call `/api/native-config` (VERIFIED — hardcoded `Config.kt`).
- **Live iOS v3.2:** no native-config; hardcoded `reach-radio-web.pages.dev` (see GO-TO-PRODUCTION.md deep-dive).

### 3.4 Legacy Astro site (`reach-radio-web`, Cloudflare Pages)
Direct Sanity client (`src/utils/SanityClient.ts`, env `PUBLIC_SANITY_PROJECT_ID`/`PUBLIC_SANITY_DATASET`, CDN and non-CDN clients). Reads at request time (SSR), no tag cache.
- **`MediaBarContainer.astro:7-36, 299-309`** reads `appSettings.radioAudioURL` and plays it in an `<audio>` element **except in the native app** (`isMobileApp` hides the bar and omits `<audio>`).
- `SEO.astro`, `OrganizationSchema.astro` read `siteSettings`.
- `teachers/*`, `scheduled-list`, `sitemap.xml.ts`, donate/privacy pages also query Sanity.

**Critical coupling (VERIFIED + INFERRED):** the live Astro site's browser player uses the **same** `appSettings.radioAudioURL` as the new site. Today that URL (`reach.radio/api/audio-stream`) resolves to Astro itself. After the DNS cutover it resolves to whatever serves `reach.radio/api/audio-stream` — so changing that hostname's target, or editing `radioAudioURL`, affects the Astro desktop player and v4 and the Next.js player simultaneously. It does **not** affect the native audio of live iOS/Android (they hardcode pages.dev).

### 3.5 Native apps — what they take from Sanity
| App | Sanity data used | How |
|---|---|---|
| iOS v4 | stream URL, web URL, host URL | via `/api/native-config` |
| iOS v3.2 (live) | none | all hardcoded |
| iOS Watch | none dynamic | stream hardcoded `https://reach.radio/api/audio-stream`; artwork = hardcoded cdn.sanity.io image (`WatchStore.swift:18`) |
| Android | none dynamic | `Config.kt` pages.dev stream; artwork = hardcoded cdn.sanity.io image (`Config.kt:8`) |
| Both | `cdn.sanity.io/images/bk05c6rl/...` album art | hardcoded; changing/deleting that asset breaks default artwork in apps |

Teacher/schedule content reaches native apps only **through the WebView** (the website), not directly from Sanity. Now-playing metadata comes from `/api/stream-info-sse` (radiojar), not Sanity.

---

## 4. Data flow

```text
 Sanity (bk05c6rl/production)
   teacher | siteSettings | appSettings
        |                         |
        | webhook POST            | CDN GET (published)
        v                         v
 /api/revalidate  --tags-->  Next.js cache (sanityFetch, days)
 (x-webhook-secret)               |
                                  +--> pages (teachers, schedule, about, SEO)
                                  +--> layout: radioAudioURL -> web player
                                  +--> /api/native-config --> iOS v4
                                                              (streamUrl, webUrl)

 Sanity ---- direct SSR GET ---> Astro (pages.dev / current reach.radio)
                                  +--> web player (radioAudioURL)
                                  +--> WebView content for live iOS/Android
```

---

## 5. Go-live implications (Sanity-specific)

1. **`radioAudioURL` is the single switch for web + v4 + Astro desktop player stream.** If the stream moves (e.g. to a stream subdomain or capless host), edit this field; Next.js picks it up after webhook/`appSettings` revalidation, v4 after the 5-min `native-config` cache. Live iOS/Android are unaffected (hardcoded).
2. **Fix `hostURL`** (stale workers.dev) before relying on it as a fallback. Set to the final production URL.
3. **`NEXT_PUBLIC_SITE_URL` must equal `https://reach.radio`** at cutover (build-time). Else `native-config.webUrl` keeps sending v4 to vercel.app. Env var exists in Production (value unread).
4. **Webhook target** must be updated/confirmed; schedule tag gap (§3.2) should be fixed.
5. **Keep Astro reading Sanity** — the live apps' WebViews depend on Astro content; any schema field rename/removal breaks Astro queries (`SEO.astro`, `MediaBarContainer.astro` use `...` spread of appSettings). Treat schema changes as cross-repo.
6. **Editor safety:** `appSettings` and `siteSettings` are not enforced singletons. Editors could create duplicates; `appSettings` is ID-pinned (safe), `siteSettings` uses `[0]` (order undefined if duplicated).

## 6. Open items / UNKNOWN

- Sanity webhook config (URL, filter, projection includes `_type`/`_updatedAt`, secret in sync with Vercel). Needs Sanity manage access/token.
- Whether anything else (Zapier, other apps) reads this dataset. Sanity project member/token list not checked.
- Actual `NEXT_PUBLIC_SITE_URL` value in Vercel.
- Whether Doppler syncs Sanity-related env into Vercel.
