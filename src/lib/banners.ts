import type { DateWindow } from '@/lib/date-window'

export type BannerIcon = 'radio-tower' | 'info' | 'calendar' | 'heart'

export interface SiteBanner extends DateWindow {
  /** Unique, dated id (YYYY-MM-DD-slug). Dismissal is stored per id, so a new id re-shows the banner. */
  id: string
  /** Paragraphs rendered in order; the last one is emphasized as the sign-off when there are 2+. */
  paragraphs: readonly string[]
  /** Defaults to 'radio-tower'. A key, not a component, so config can cross the server/client boundary. */
  icon?: BannerIcon
  /** Optional call to action shown under the text. Paths starting with `/` are internal. */
  link?: { href: string; label: string }
}

/**
 * Banners for the top of the home page. The first one that is in its date window and not
 * dismissed is shown. Add new entries with a new dated id (e.g. each year's silent drive);
 * remove old ones when they no longer matter.
 */
export const HOME_BANNERS: readonly SiteBanner[] = []
// The 2026-11-11 106.7FM signal notice was retired before launch; see git history (e17ea4f) for its text.

export const BANNER_DISMISSED_PREFIX = 'banner-dismissed:'
